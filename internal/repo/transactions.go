package repo

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/mrbelka12000/hz_zachem/internal/models"
)

type TransactionRepo struct {
	db *gorm.DB
}

type TransactionFilter struct {
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

const (
	defaultListLimit = 50
	maxListLimit     = 200
)

func (r *TransactionRepo) Create(ctx context.Context, t *models.Transaction) error {
	if err := r.db.WithContext(ctx).Create(t).Error; err != nil {
		return mapErr(err)
	}
	return nil
}

func (r *TransactionRepo) FindByIdempotency(ctx context.Context, householdID models.ID, key string) (*models.Transaction, error) {
	var t models.Transaction
	err := r.db.WithContext(ctx).
		Where("household_id = ? AND idempotency_key = ?", householdID, key).
		First(&t).Error
	if err != nil {
		return nil, mapErr(err)
	}
	return &t, nil
}

func (r *TransactionRepo) FindByExternalHash(ctx context.Context, householdID, accountID models.ID, hash string) (*models.Transaction, error) {
	var t models.Transaction
	err := r.db.WithContext(ctx).
		Where("household_id = ? AND account_id = ? AND external_hash = ?", householdID, accountID, hash).
		First(&t).Error
	if err != nil {
		return nil, mapErr(err)
	}
	return &t, nil
}

// FindTransferCounterpart returns the OTHER row that shares this row's
// transfer_id within the same household. Used to render the matching
// leg of a transfer in the detail view.
func (r *TransactionRepo) FindTransferCounterpart(ctx context.Context, householdID, transferID, excludeID models.ID) (*models.Transaction, error) {
	var t models.Transaction
	err := r.db.WithContext(ctx).
		Where("household_id = ? AND transfer_id = ? AND id <> ?", householdID, transferID, excludeID).
		First(&t).Error
	if err != nil {
		return nil, mapErr(err)
	}
	return &t, nil
}

// ListUnpairedExpenseAndIncome returns rows that are candidates for
// transfer pairing: still alive, not yet part of a transfer, and of
// type expense or income. Service layer does the actual matching
// in-memory.
func (r *TransactionRepo) ListUnpairedExpenseAndIncome(ctx context.Context, householdID models.ID) ([]models.Transaction, error) {
	var rows []models.Transaction
	err := r.db.WithContext(ctx).
		Where("household_id = ? AND transfer_id IS NULL AND type IN (?,?)",
			householdID,
			models.TransactionTypeExpense,
			models.TransactionTypeIncome,
		).
		Order("occurred_at ASC, id ASC").
		Find(&rows).Error
	if err != nil {
		return nil, mapErr(err)
	}
	return rows, nil
}

// PairAsTransfer atomically converts one expense + one income row
// (already validated by the caller) into a paired transfer leg. Both
// rows must belong to the household and currently have transfer_id IS NULL.
//
// The two rows are updated separately so each leg can record its own
// direction: 'out' on the original expense, 'in' on the original income.
func (r *TransactionRepo) PairAsTransfer(ctx context.Context, householdID, expenseID, incomeID, transferID models.ID) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		commonUpdates := func(direction models.TransferDirection) map[string]any {
			return map[string]any{
				"type":               models.TransactionTypeTransfer,
				"transfer_id":        transferID,
				"transfer_direction": direction,
				"category_id":        nil,
				"category_source":    models.CategorySourceNone,
				"updated_at":         gorm.Expr("NOW()"),
			}
		}
		outRes := tx.Model(&models.Transaction{}).
			Where("household_id = ? AND id = ? AND transfer_id IS NULL", householdID, expenseID).
			Updates(commonUpdates(models.TransferDirectionOut))
		if outRes.Error != nil {
			return mapErr(outRes.Error)
		}
		if outRes.RowsAffected != 1 {
			return ErrConflict
		}
		inRes := tx.Model(&models.Transaction{}).
			Where("household_id = ? AND id = ? AND transfer_id IS NULL", householdID, incomeID).
			Updates(commonUpdates(models.TransferDirectionIn))
		if inRes.Error != nil {
			return mapErr(inRes.Error)
		}
		if inRes.RowsAffected != 1 {
			return ErrConflict
		}
		return nil
	})
}

func (r *TransactionRepo) GetByID(ctx context.Context, householdID, id models.ID) (*models.Transaction, error) {
	var t models.Transaction
	err := r.db.WithContext(ctx).
		Where("household_id = ? AND id = ?", householdID, id).
		First(&t).Error
	if err != nil {
		return nil, mapErr(err)
	}
	return &t, nil
}

func (r *TransactionRepo) CreateTransfer(ctx context.Context, expense, income *models.Transaction) error {
	transferID := uuid.New()
	expense.TransferID = &transferID
	expense.Type = models.TransactionTypeTransfer
	income.TransferID = &transferID
	income.Type = models.TransactionTypeTransfer

	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(expense).Error; err != nil {
			return mapErr(err)
		}
		if err := tx.Create(income).Error; err != nil {
			return mapErr(err)
		}
		return nil
	})
}

func (r *TransactionRepo) List(ctx context.Context, f TransactionFilter) ([]models.Transaction, error) {
	q := r.db.WithContext(ctx).Where("household_id = ?", f.HouseholdID)

	if f.From != nil {
		q = q.Where("occurred_at >= ?", *f.From)
	}
	if f.To != nil {
		q = q.Where("occurred_at < ?", *f.To)
	}
	if f.CategoryID != nil {
		q = q.Where("category_id = ?", *f.CategoryID)
	}
	if f.UncategorizedOnly {
		q = q.Where("category_id IS NULL")
	}
	if f.AccountID != nil {
		q = q.Where("account_id = ?", *f.AccountID)
	}
	if f.Type != nil {
		q = q.Where("type = ?", *f.Type)
	}
	if f.Search != "" {
		like := "%" + f.Search + "%"
		q = q.Where("description ILIKE ? OR merchant ILIKE ?", like, like)
	}
	if f.AmountMin != nil {
		q = q.Where("amount >= ?", *f.AmountMin)
	}
	if f.AmountMax != nil {
		q = q.Where("amount <= ?", *f.AmountMax)
	}
	if f.CursorOccurredAt != nil && f.CursorID != nil {
		q = q.Where("(occurred_at, id) < (?, ?)", *f.CursorOccurredAt, *f.CursorID)
	}

	limit := f.Limit
	if limit <= 0 {
		limit = defaultListLimit
	}
	if limit > maxListLimit {
		limit = maxListLimit
	}

	var transactions []models.Transaction
	if err := q.Order("occurred_at DESC, id DESC").Limit(limit).Find(&transactions).Error; err != nil {
		return nil, mapErr(err)
	}
	return transactions, nil
}

func (r *TransactionRepo) Update(ctx context.Context, t *models.Transaction, updatedBy models.ID) error {
	updates := map[string]any{
		"description":     t.Description,
		"merchant":        t.Merchant,
		"category_id":     t.CategoryID,
		"category_source": t.CategorySource,
		"occurred_at":     t.OccurredAt,
		"amount":          t.Amount,
		"updated_by":      updatedBy,
		"updated_at":      gorm.Expr("NOW()"),
	}
	res := r.db.WithContext(ctx).
		Model(&models.Transaction{}).
		Where("household_id = ? AND id = ?", t.HouseholdID, t.ID).
		Updates(updates)
	if res.Error != nil {
		return mapErr(res.Error)
	}
	if res.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *TransactionRepo) SoftDelete(ctx context.Context, householdID, id, deletedBy models.ID) error {
	res := r.db.WithContext(ctx).
		Model(&models.Transaction{}).
		Where("household_id = ? AND id = ?", householdID, id).
		Updates(map[string]any{
			"deleted_at": gorm.Expr("NOW()"),
			"deleted_by": deletedBy,
		})
	if res.Error != nil {
		return mapErr(res.Error)
	}
	if res.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

func IsConflict(err error) bool { return errors.Is(err, ErrConflict) }
