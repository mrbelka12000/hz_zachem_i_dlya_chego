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
