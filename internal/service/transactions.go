package service

import (
	"context"
	"errors"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"

	"github.com/mrbelka12000/hz_zachem/internal/models"
	"github.com/mrbelka12000/hz_zachem/internal/repo"
)

type TransactionService struct {
	repo       *repo.Repository
	households *HouseholdService
	accounts   *AccountService
}

type CreateTransactionInput struct {
	HouseholdID    models.ID
	AccountID      models.ID
	Type           models.TransactionType
	Amount         models.Money
	OccurredAt     time.Time
	Description    string
	Merchant       string
	CategoryID     *models.ID
	IdempotencyKey string
	CreatedBy      models.ID
}

type CreateTransferInput struct {
	HouseholdID    models.ID
	FromAccountID  models.ID
	ToAccountID    models.ID
	Amount         models.Money
	OccurredAt     time.Time
	Description    string
	IdempotencyKey string
	CreatedBy      models.ID
}

type ListTransactionsInput struct {
	HouseholdID       models.ID
	From              *time.Time
	To                *time.Time
	CategoryID        *models.ID
	AccountID         *models.ID
	Type              *models.TransactionType
	UncategorizedOnly bool
	Search            string
	AmountMin         *models.Money
	AmountMax         *models.Money
	Limit             int
	CursorOccurredAt  *time.Time
	CursorID          *models.ID
}

type UpdateTransactionInput struct {
	HouseholdID models.ID
	ID          models.ID
	OccurredAt  time.Time
	Amount      models.Money
	Description string
	Merchant    string
	CategoryID  *models.ID
	UpdatedBy   models.ID
}

func (s *TransactionService) Create(ctx context.Context, in CreateTransactionInput) (*models.Transaction, error) {
	if !in.Type.Valid() || in.Type == models.TransactionTypeTransfer {
		return nil, ErrInvalidInput
	}
	if in.Amount.LessThanOrEqual(decimal.Zero) {
		return nil, ErrInvalidInput
	}
	if in.OccurredAt.IsZero() {
		in.OccurredAt = time.Now()
	}
	in.Description = strings.TrimSpace(in.Description)
	in.Merchant = strings.TrimSpace(in.Merchant)

	account, err := s.accounts.Get(ctx, in.HouseholdID, in.AccountID)
	if err != nil {
		return nil, err
	}

	if in.IdempotencyKey != "" {
		if existing, err := s.repo.Transactions.FindByIdempotency(ctx, in.HouseholdID, in.IdempotencyKey); err == nil {
			return existing, nil
		} else if !errors.Is(err, repo.ErrNotFound) {
			return nil, err
		}
	}

	source := models.CategorySourceNone
	if in.CategoryID != nil {
		source = models.CategorySourceManual
	}

	t := &models.Transaction{
		HouseholdID:    in.HouseholdID,
		AccountID:      in.AccountID,
		Type:           in.Type,
		Amount:         in.Amount,
		Currency:       account.Currency,
		OccurredAt:     in.OccurredAt,
		Description:    in.Description,
		Merchant:       in.Merchant,
		CategoryID:     in.CategoryID,
		CategorySource: source,
		Source:         models.TransactionSourceManual,
		CreatedBy:      in.CreatedBy,
	}
	if in.IdempotencyKey != "" {
		key := in.IdempotencyKey
		t.IdempotencyKey = &key
	}
	if err := s.repo.Transactions.Create(ctx, t); err != nil {
		if errors.Is(err, repo.ErrConflict) {
			return nil, ErrConflict
		}
		return nil, err
	}
	return t, nil
}

func (s *TransactionService) CreateTransfer(ctx context.Context, in CreateTransferInput) (expense, income *models.Transaction, err error) {
	if in.FromAccountID == in.ToAccountID {
		return nil, nil, ErrTransferSameAccount
	}
	if in.Amount.LessThanOrEqual(decimal.Zero) {
		return nil, nil, ErrInvalidInput
	}
	if in.OccurredAt.IsZero() {
		in.OccurredAt = time.Now()
	}
	from, err := s.accounts.Get(ctx, in.HouseholdID, in.FromAccountID)
	if err != nil {
		return nil, nil, err
	}
	to, err := s.accounts.Get(ctx, in.HouseholdID, in.ToAccountID)
	if err != nil {
		return nil, nil, err
	}
	if !strings.EqualFold(from.Currency, to.Currency) {
		return nil, nil, ErrCurrencyMismatch
	}
	desc := strings.TrimSpace(in.Description)
	out := models.TransferDirectionOut
	inDir := models.TransferDirectionIn
	expense = &models.Transaction{
		HouseholdID:       in.HouseholdID,
		AccountID:         in.FromAccountID,
		Type:              models.TransactionTypeTransfer,
		TransferDirection: &out,
		Amount:            in.Amount,
		Currency:          from.Currency,
		OccurredAt:        in.OccurredAt,
		Description:       desc,
		Source:            models.TransactionSourceManual,
		CreatedBy:         in.CreatedBy,
	}
	income = &models.Transaction{
		HouseholdID:       in.HouseholdID,
		AccountID:         in.ToAccountID,
		Type:              models.TransactionTypeTransfer,
		TransferDirection: &inDir,
		Amount:            in.Amount,
		Currency:          to.Currency,
		OccurredAt:        in.OccurredAt,
		Description:       desc,
		Source:            models.TransactionSourceManual,
		CreatedBy:         in.CreatedBy,
	}
	if cerr := s.repo.Transactions.CreateTransfer(ctx, expense, income); cerr != nil {
		return nil, nil, cerr
	}
	return expense, income, nil
}

func (s *TransactionService) Get(ctx context.Context, householdID, id models.ID) (*models.Transaction, error) {
	t, err := s.repo.Transactions.GetByID(ctx, householdID, id)
	if err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return t, nil
}

// GetWithCounterpart returns the transaction and, when it is a transfer
// leg with a still-existing counterpart, populates t.Counterpart so a
// single API response can render both sides.
func (s *TransactionService) GetWithCounterpart(ctx context.Context, householdID, id models.ID) (*models.Transaction, error) {
	t, err := s.Get(ctx, householdID, id)
	if err != nil {
		return nil, err
	}
	if t.TransferID == nil {
		return t, nil
	}
	cp, err := s.repo.Transactions.FindTransferCounterpart(ctx, householdID, *t.TransferID, t.ID)
	if err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return t, nil
		}
		return nil, err
	}
	t.Counterpart = cp
	return t, nil
}

func (s *TransactionService) List(ctx context.Context, in ListTransactionsInput) ([]models.Transaction, error) {
	return s.repo.Transactions.List(ctx, repo.TransactionFilter{
		HouseholdID:       in.HouseholdID,
		From:              in.From,
		To:                in.To,
		CategoryID:        in.CategoryID,
		AccountID:         in.AccountID,
		Type:              in.Type,
		UncategorizedOnly: in.UncategorizedOnly,
		Search:            in.Search,
		AmountMin:         in.AmountMin,
		AmountMax:         in.AmountMax,
		Limit:             in.Limit,
		CursorOccurredAt:  in.CursorOccurredAt,
		CursorID:          in.CursorID,
	})
}

func (s *TransactionService) Update(ctx context.Context, in UpdateTransactionInput) (*models.Transaction, error) {
	if in.Amount.LessThanOrEqual(decimal.Zero) {
		return nil, ErrInvalidInput
	}
	t := &models.Transaction{
		ID:             in.ID,
		HouseholdID:    in.HouseholdID,
		Amount:         in.Amount,
		OccurredAt:     in.OccurredAt,
		Description:    strings.TrimSpace(in.Description),
		Merchant:       strings.TrimSpace(in.Merchant),
		CategoryID:     in.CategoryID,
		CategorySource: categorySourceForUpdate(in.CategoryID),
	}
	if err := s.repo.Transactions.Update(ctx, t, in.UpdatedBy); err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return s.Get(ctx, in.HouseholdID, in.ID)
}

// Unpair reverts a transfer leg (and its counterpart, when present)
// back to plain expense / income rows. Each leg's restored type comes
// from its transfer_direction:
//
//	'out'  -> expense
//	'in'   -> income
//	(null) -> expense (legacy paired rows lacked direction; user can edit)
//
// Returns the number of rows that were unpaired (1 for orphan, 2 for
// a normal pair).
func (s *TransactionService) Unpair(ctx context.Context, householdID, id models.ID) (int, error) {
	t, err := s.Get(ctx, householdID, id)
	if err != nil {
		return 0, err
	}
	if t.TransferID == nil {
		return 0, ErrInvalidInput
	}

	legs := []repo.UnpairLeg{{ID: t.ID, Type: restoreTypeFromDirection(t.TransferDirection)}}

	cp, err := s.repo.Transactions.FindTransferCounterpart(ctx, householdID, *t.TransferID, t.ID)
	if err != nil && !errors.Is(err, repo.ErrNotFound) {
		return 0, err
	}
	if err == nil {
		legs = append(legs, repo.UnpairLeg{
			ID:   cp.ID,
			Type: restoreTypeFromDirection(cp.TransferDirection),
		})
	}

	if err := s.repo.Transactions.UnpairTransfer(ctx, householdID, legs); err != nil {
		if errors.Is(err, repo.ErrConflict) {
			// Someone unpaired between the read and the write; treat as no-op.
			return 0, nil
		}
		return 0, err
	}
	return len(legs), nil
}

func restoreTypeFromDirection(d *models.TransferDirection) models.TransactionType {
	if d != nil && *d == models.TransferDirectionIn {
		return models.TransactionTypeIncome
	}
	return models.TransactionTypeExpense
}

func (s *TransactionService) SoftDelete(ctx context.Context, householdID, id, deletedBy models.ID) error {
	if err := s.repo.Transactions.SoftDelete(ctx, householdID, id, deletedBy); err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return ErrNotFound
		}
		return err
	}
	return nil
}

func categorySourceForUpdate(categoryID *models.ID) models.CategorySource {
	if categoryID == nil {
		return models.CategorySourceNone
	}
	return models.CategorySourceManual
}

// PairTransfers scans the household's unpaired expense+income rows and
// merges each unambiguous pair into a transfer.
//
// Match rule: same calendar day in the household timezone, same amount,
// same currency, different accounts. Pairing happens element-wise when
// the bucket is balanced and all expenses sit on one account while all
// incomes sit on a different one — anything else is left alone so the
// user can pair manually.
func (s *TransactionService) PairTransfers(ctx context.Context, householdID models.ID) (int, error) {
	h, err := s.households.Get(ctx, householdID)
	if err != nil {
		return 0, err
	}
	loc, err := time.LoadLocation(h.Timezone)
	if err != nil {
		loc = time.UTC
	}

	rows, err := s.repo.Transactions.ListUnpairedExpenseAndIncome(ctx, householdID)
	if err != nil {
		return 0, err
	}

	buckets := groupTransfersByBucket(rows, loc)

	paired := 0
	for _, b := range buckets {
		if !b.canAutoPair() {
			continue
		}
		b.sortLegs()
		n, err := s.pairBucket(ctx, householdID, b)
		paired += n
		if err != nil {
			return paired, err
		}
	}
	return paired, nil
}

type pairBucketKey struct {
	day      string
	amount   string
	currency string
}

type pairBucket struct {
	expenses []models.Transaction
	incomes  []models.Transaction
}

// canAutoPair holds when the bucket is balanced and the expenses /
// incomes sit on a single (different) account each. Anything else is
// ambiguous and left for manual pairing.
func (b *pairBucket) canAutoPair() bool {
	if len(b.expenses) == 0 || len(b.expenses) != len(b.incomes) {
		return false
	}
	expAcc := b.expenses[0].AccountID
	incAcc := b.incomes[0].AccountID
	if expAcc == incAcc {
		return false
	}
	for _, e := range b.expenses {
		if e.AccountID != expAcc {
			return false
		}
	}
	for _, i := range b.incomes {
		if i.AccountID != incAcc {
			return false
		}
	}
	return true
}

// sortLegs orders both slices by (occurred_at, id) so the same input
// yields the same pairings deterministically across runs.
func (b *pairBucket) sortLegs() {
	sortByOccurredThenID(b.expenses)
	sortByOccurredThenID(b.incomes)
}

func sortByOccurredThenID(rows []models.Transaction) {
	sort.Slice(rows, func(i, j int) bool {
		if !rows[i].OccurredAt.Equal(rows[j].OccurredAt) {
			return rows[i].OccurredAt.Before(rows[j].OccurredAt)
		}
		return rows[i].ID.String() < rows[j].ID.String()
	})
}

func groupTransfersByBucket(rows []models.Transaction, loc *time.Location) map[pairBucketKey]*pairBucket {
	buckets := map[pairBucketKey]*pairBucket{}
	for _, r := range rows {
		k := pairBucketKey{
			day:      r.OccurredAt.In(loc).Format("2006-01-02"),
			amount:   r.Amount.String(),
			currency: r.Currency,
		}
		b := buckets[k]
		if b == nil {
			b = &pairBucket{}
			buckets[k] = b
		}
		switch r.Type {
		case models.TransactionTypeExpense:
			b.expenses = append(b.expenses, r)
		case models.TransactionTypeIncome:
			b.incomes = append(b.incomes, r)
		}
	}
	return buckets
}

// pairBucket persists one bucket's pairings, returning the count of
// transfers actually created. Conflicts are skipped (idempotent retry);
// any other error aborts.
func (s *TransactionService) pairBucket(ctx context.Context, householdID models.ID, b *pairBucket) (int, error) {
	paired := 0
	for k := range b.expenses {
		transferID, err := uuid.NewRandom()
		if err != nil {
			return paired, err
		}
		if err := s.repo.Transactions.PairAsTransfer(ctx, householdID, b.expenses[k].ID, b.incomes[k].ID, transferID); err != nil {
			if errors.Is(err, repo.ErrConflict) {
				continue
			}
			return paired, err
		}
		paired++
	}
	return paired, nil
}
