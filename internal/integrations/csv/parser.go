// Package csv parses uploaded transaction lists.
//
// There is exactly ONE supported wire format. If a bank exports
// differently, convert to this shape before uploading.
//
//	Date,Amount,Name,Type
//	10/05/2026,-1500.00,Magnum,Покупка
//	10/05/2026,200000.00,Salary,Пополнение
//
//   - Date is dd/mm/yyyy (zero-padded)
//   - Amount is a signed decimal (- = outflow, + = inflow), at most 2 decimals
//   - Name is free text; we treat it as the merchant
//   - Type is free text; we treat it as the row description
package csv

import (
	"crypto/sha256"
	"encoding/csv"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"github.com/shopspring/decimal"

	"github.com/mrbelka12000/hz_zachem/internal/models"
)

const dateLayout = "02/01/2006"

var requiredHeader = []string{"Date", "Amount", "Name", "Type"}

// ParsedRow is one transaction lifted from the CSV. Service-layer code
// supplies account / household / created_by; we only carry what the
// row itself proves.
type ParsedRow struct {
	OccurredAt   time.Time
	Type         models.TransactionType // expense if amount<0, income if >0
	Amount       decimal.Decimal        // always positive (sign is in Type)
	Merchant     string
	Description  string
	ExternalHash string
	RawPayload   json.RawMessage
}

// RowError is the per-row failure mode reported back to the caller.
// Successful rows are not wrapped.
type RowError struct {
	Line    int    `json:"line"`    // 1-indexed including header
	Message string `json:"message"`
}

func (e RowError) Error() string {
	return fmt.Sprintf("line %d: %s", e.Line, e.Message)
}

// Parse reads the canonical CSV from r. Returns successfully parsed
// rows and a parallel slice of row-level errors. A header mismatch
// is returned as the third value (no rows / errs in that case).
func Parse(r io.Reader) ([]ParsedRow, []RowError, error) {
	reader := csv.NewReader(r)
	reader.TrimLeadingSpace = true
	reader.FieldsPerRecord = -1 // tolerate trailing blank lines

	header, err := reader.Read()
	if err != nil {
		if errors.Is(err, io.EOF) {
			return nil, nil, errors.New("csv: empty file")
		}
		return nil, nil, fmt.Errorf("csv: read header: %w", err)
	}
	if err := validateHeader(header); err != nil {
		return nil, nil, err
	}

	var rows []ParsedRow
	var errs []RowError
	// Tracks how many times we've seen the same (date, amount, type, merchant,
	// description) tuple within this file. Lets the dedup hash distinguish
	// legitimate duplicates from each other (e.g. four 500k transfers in a
	// day) while still collapsing a re-upload of the same file.
	occurrence := map[string]int{}
	line := 1 // header was line 1
	for {
		line++
		rec, err := reader.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			errs = append(errs, RowError{Line: line, Message: "malformed row: " + err.Error()})
			continue
		}
		if isBlank(rec) {
			continue
		}
		row, rowErr := parseRow(rec)
		if rowErr != "" {
			errs = append(errs, RowError{Line: line, Message: rowErr})
			continue
		}
		canon := canonicalKey(row.OccurredAt, row.Amount.String(), row.Type, row.Merchant, row.Description)
		occurrence[canon]++
		row.ExternalHash = hashCanonical(canon, occurrence[canon])
		rows = append(rows, row)
	}
	return rows, errs, nil
}

func validateHeader(got []string) error {
	if len(got) < len(requiredHeader) {
		return fmt.Errorf("csv: header must be %q, got %q", strings.Join(requiredHeader, ","), strings.Join(got, ","))
	}
	for i, want := range requiredHeader {
		if !strings.EqualFold(strings.TrimSpace(got[i]), want) {
			return fmt.Errorf("csv: header column %d must be %q, got %q", i+1, want, got[i])
		}
	}
	return nil
}

func parseRow(rec []string) (ParsedRow, string) {
	if len(rec) < 4 {
		return ParsedRow{}, "expected 4 columns"
	}
	dateStr := strings.TrimSpace(rec[0])
	amountStr := normalizeAmount(rec[1])
	name := strings.TrimSpace(rec[2])
	typeStr := strings.TrimSpace(rec[3])

	occurred, err := time.Parse(dateLayout, dateStr)
	if err != nil {
		return ParsedRow{}, fmt.Sprintf("invalid date %q (expected dd/mm/yyyy)", dateStr)
	}
	amount, err := decimal.NewFromString(amountStr)
	if err != nil {
		return ParsedRow{}, fmt.Sprintf("invalid amount %q", rec[1])
	}
	if amount.IsZero() {
		return ParsedRow{}, "amount must be non-zero"
	}

	txType := models.TransactionTypeExpense
	if amount.IsPositive() {
		txType = models.TransactionTypeIncome
	}
	abs := amount.Abs()

	raw, _ := json.Marshal(map[string]string{
		"date":   dateStr,
		"amount": amountStr,
		"name":   name,
		"type":   typeStr,
	})

	return ParsedRow{
		OccurredAt:  occurred,
		Type:        txType,
		Amount:      abs,
		Merchant:    name,
		Description: typeStr,
		// ExternalHash is set by Parse so it can include a per-occurrence
		// suffix that distinguishes legitimate same-content duplicates.
		RawPayload: raw,
	}, ""
}

func normalizeAmount(s string) string {
	out := strings.TrimSpace(s)
	out = strings.ReplaceAll(out, " ", "")
	out = strings.ReplaceAll(out, " ", "") // NBSP from some exports
	out = strings.ReplaceAll(out, ",", ".")
	return out
}

func isBlank(rec []string) bool {
	for _, c := range rec {
		if strings.TrimSpace(c) != "" {
			return false
		}
	}
	return true
}

// canonicalKey is the content fingerprint of a row, ignoring ordering.
// Two rows with identical canonical keys are by-content duplicates.
func canonicalKey(occurred time.Time, amount string, txType models.TransactionType, merchant, description string) string {
	return strings.Join([]string{
		occurred.UTC().Format(time.RFC3339),
		amount,
		string(txType),
		strings.ToLower(strings.TrimSpace(merchant)),
		strings.ToLower(strings.TrimSpace(description)),
	}, "|")
}

// hashCanonical produces the value stored in transactions.external_hash.
//
// The 1st occurrence of a canonical key in a file gets the original
// content-only hash (backwards compatible with rows imported before
// this fix). Subsequent occurrences (2nd, 3rd, …) include the
// occurrence index in the digest so legitimate duplicates dedupe
// correctly across re-imports without colliding within one file.
func hashCanonical(canon string, occurrence int) string {
	if occurrence > 1 {
		canon = canon + "|#" + strconv.Itoa(occurrence)
	}
	sum := sha256.Sum256([]byte(canon))
	return hex.EncodeToString(sum[:])
}
