package repo

import (
	"context"
	"time"

	"gorm.io/gorm"

	"github.com/mrbelka12000/hz_zachem/internal/models"
)

type AnalyticsRepo struct {
	db *gorm.DB
}

// CategorySpendRow is one (category, currency) bucket. Aggregations
// preserve currency so the SPA can convert each row to KZT before
// merging — backend stays FX-agnostic.
type CategorySpendRow struct {
	CategoryID   *models.ID   `json:"category_id"`
	CategoryName string       `json:"category_name"`
	Currency     string       `json:"currency"`
	Total        models.Money `json:"total"`
	Count        int64        `json:"count"`
}

type MonthSpendRow struct {
	Month    time.Time    `json:"month"`
	Currency string       `json:"currency"`
	Total    models.Money `json:"total"`
	Count    int64        `json:"count"`
}

type MerchantSpendRow struct {
	Merchant string       `json:"merchant"`
	Currency string       `json:"currency"`
	Total    models.Money `json:"total"`
	Count    int64        `json:"count"`
}

type CashflowMonthRow struct {
	Month    time.Time    `json:"month"`
	Currency string       `json:"currency"`
	Expense  models.Money `json:"expense"`
	Income   models.Money `json:"income"`
	Net      models.Money `json:"net"`
}

const excludeNonSpending = `
		AND t.type = 'expense'
		AND t.transfer_id IS NULL
		AND t.deleted_at IS NULL
	`

const excludeNonCashflow = `
		AND t.type IN ('expense','income')
		AND t.transfer_id IS NULL
		AND t.deleted_at IS NULL
	`

// excludeDeletedAccounts drops rows whose parent account has been
// soft-deleted. GORM only auto-applies the deleted_at filter to
// queries it routes itself; these raw analytics queries select
// straight from `transactions` and need an explicit check so a user
// hitting "Delete account" stops contributing to stats.
const excludeDeletedAccounts = `
		AND EXISTS (
			SELECT 1 FROM accounts a
			WHERE a.id = t.account_id AND a.deleted_at IS NULL
		)
	`

func (r *AnalyticsRepo) SpendingByCategory(ctx context.Context, householdID models.ID, from, to time.Time) ([]CategorySpendRow, error) {
	var rows []CategorySpendRow
	err := r.db.WithContext(ctx).Raw(`
		SELECT
			t.category_id,
			COALESCE(c.name, 'Uncategorized') AS category_name,
			t.currency,
			SUM(t.amount) AS total,
			COUNT(*) AS count
		FROM transactions t
		LEFT JOIN categories c ON c.id = t.category_id AND c.deleted_at IS NULL
		WHERE t.household_id = ?
		  AND t.occurred_at >= ?
		  AND t.occurred_at < ?
		  `+excludeNonSpending+excludeDeletedAccounts+`
		GROUP BY t.category_id, c.name, t.currency
		ORDER BY total DESC
	`, householdID, from, to).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	return rows, nil
}

func (r *AnalyticsRepo) SpendingByMonth(ctx context.Context, householdID models.ID, timezone string, from, to time.Time) ([]MonthSpendRow, error) {
	var rows []MonthSpendRow
	err := r.db.WithContext(ctx).Raw(`
		SELECT
			date_trunc('month', t.occurred_at AT TIME ZONE ?) AS month,
			t.currency,
			SUM(t.amount) AS total,
			COUNT(*) AS count
		FROM transactions t
		WHERE t.household_id = ?
		  AND t.occurred_at >= ?
		  AND t.occurred_at < ?
		  `+excludeNonSpending+excludeDeletedAccounts+`
		GROUP BY month, t.currency
		ORDER BY month ASC
	`, timezone, householdID, from, to).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	return rows, nil
}

func (r *AnalyticsRepo) TopMerchants(ctx context.Context, householdID models.ID, from, to time.Time, limit int) ([]MerchantSpendRow, error) {
	if limit <= 0 {
		limit = 10
	}
	var rows []MerchantSpendRow
	err := r.db.WithContext(ctx).Raw(`
		SELECT
			lower(t.merchant) AS merchant,
			t.currency,
			SUM(t.amount) AS total,
			COUNT(*) AS count
		FROM transactions t
		WHERE t.household_id = ?
		  AND t.occurred_at >= ?
		  AND t.occurred_at < ?
		  AND t.merchant <> ''
		  `+excludeNonSpending+excludeDeletedAccounts+`
		GROUP BY lower(t.merchant), t.currency
		ORDER BY total DESC
		LIMIT ?
	`, householdID, from, to, limit).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	return rows, nil
}

// IncomeByCategory mirrors SpendingByCategory but for type='income'.
// Transfers, soft-deleted transactions, and rows on soft-deleted
// accounts are all excluded.
func (r *AnalyticsRepo) IncomeByCategory(ctx context.Context, householdID models.ID, from, to time.Time) ([]CategorySpendRow, error) {
	var rows []CategorySpendRow
	err := r.db.WithContext(ctx).Raw(`
		SELECT
			t.category_id,
			COALESCE(c.name, 'Uncategorized') AS category_name,
			t.currency,
			SUM(t.amount) AS total,
			COUNT(*) AS count
		FROM transactions t
		LEFT JOIN categories c ON c.id = t.category_id AND c.deleted_at IS NULL
		WHERE t.household_id = ?
		  AND t.occurred_at >= ?
		  AND t.occurred_at < ?
		  AND t.type = 'income'
		  AND t.transfer_id IS NULL
		  AND t.deleted_at IS NULL
		  `+excludeDeletedAccounts+`
		GROUP BY t.category_id, c.name, t.currency
		ORDER BY total DESC
	`, householdID, from, to).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	return rows, nil
}

// CashflowByMonth groups by (month, currency) so the SPA can convert
// each row to KZT before merging months across currencies.
func (r *AnalyticsRepo) CashflowByMonth(ctx context.Context, householdID models.ID, timezone string, from, to time.Time) ([]CashflowMonthRow, error) {
	var rows []CashflowMonthRow
	err := r.db.WithContext(ctx).Raw(`
		SELECT
			date_trunc('month', t.occurred_at AT TIME ZONE ?) AS month,
			t.currency,
			COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) AS expense,
			COALESCE(SUM(CASE WHEN t.type = 'income'  THEN t.amount ELSE 0 END), 0) AS income,
			COALESCE(SUM(CASE WHEN t.type = 'income'  THEN t.amount ELSE 0 END), 0)
				- COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) AS net
		FROM transactions t
		WHERE t.household_id = ?
		  AND t.occurred_at >= ?
		  AND t.occurred_at < ?
		  `+excludeNonCashflow+excludeDeletedAccounts+`
		GROUP BY month, t.currency
		ORDER BY month ASC
	`, timezone, householdID, from, to).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	return rows, nil
}

// AccountCashflowByMonth is the per-account variant: same row shape as
// CashflowByMonth, but transfer legs DO count (a transfer is a real
// inflow/outflow from the chosen account's perspective). Each transfer
// row is mapped to expense/income via transfer_direction.
func (r *AnalyticsRepo) AccountCashflowByMonth(ctx context.Context, householdID, accountID models.ID, timezone string, from, to time.Time) ([]CashflowMonthRow, error) {
	var rows []CashflowMonthRow
	err := r.db.WithContext(ctx).Raw(`
		SELECT
			date_trunc('month', t.occurred_at AT TIME ZONE ?) AS month,
			t.currency,
			COALESCE(SUM(CASE
				WHEN t.type = 'expense' THEN t.amount
				WHEN t.type = 'transfer' AND t.transfer_direction = 'out' THEN t.amount
				ELSE 0 END), 0) AS expense,
			COALESCE(SUM(CASE
				WHEN t.type = 'income' THEN t.amount
				WHEN t.type = 'transfer' AND t.transfer_direction = 'in' THEN t.amount
				ELSE 0 END), 0) AS income,
			COALESCE(SUM(CASE
				WHEN t.type = 'income' OR (t.type = 'transfer' AND t.transfer_direction = 'in') THEN t.amount
				WHEN t.type = 'expense' OR (t.type = 'transfer' AND t.transfer_direction = 'out') THEN -t.amount
				ELSE 0 END), 0) AS net
		FROM transactions t
		WHERE t.household_id = ?
		  AND t.account_id = ?
		  AND t.occurred_at >= ?
		  AND t.occurred_at < ?
		  AND t.deleted_at IS NULL
		  AND t.type IN ('expense','income','transfer')
		  `+excludeDeletedAccounts+`
		GROUP BY month, t.currency
		ORDER BY month ASC
	`, timezone, householdID, accountID, from, to).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	return rows, nil
}

var _ = gorm.ErrRecordNotFound
