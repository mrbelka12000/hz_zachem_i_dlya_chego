package repo

import (
	"context"
	"errors"
	"time"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"

	"github.com/mrbelka12000/hz_zachem/internal/models"
)

type BudgetRepo struct {
	db *gorm.DB
}

func (r *BudgetRepo) Create(ctx context.Context, b *models.Budget) error {
	if err := r.db.WithContext(ctx).Create(b).Error; err != nil {
		return mapErr(err)
	}
	return nil
}

func (r *BudgetRepo) GetByID(ctx context.Context, householdID, id models.ID) (*models.Budget, error) {
	var b models.Budget
	err := r.db.WithContext(ctx).
		Where("household_id = ? AND id = ?", householdID, id).
		First(&b).Error
	if err != nil {
		return nil, mapErr(err)
	}
	return &b, nil
}

func (r *BudgetRepo) List(ctx context.Context, householdID models.ID) ([]models.Budget, error) {
	var rows []models.Budget
	err := r.db.WithContext(ctx).
		Where("household_id = ?", householdID).
		Order("created_at ASC").
		Find(&rows).Error
	if err != nil {
		return nil, mapErr(err)
	}
	return rows, nil
}

func (r *BudgetRepo) Update(ctx context.Context, b *models.Budget) error {
	res := r.db.WithContext(ctx).
		Model(&models.Budget{}).
		Where("household_id = ? AND id = ?", b.HouseholdID, b.ID).
		Updates(map[string]any{
			"name":        b.Name,
			"category_id": b.CategoryID,
			"amount":      b.Amount,
			"currency":    b.Currency,
			"enabled":     b.Enabled,
			"updated_at":  gorm.Expr("NOW()"),
		})
	if res.Error != nil {
		return mapErr(res.Error)
	}
	if res.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *BudgetRepo) SoftDelete(ctx context.Context, householdID, id, deletedBy models.ID) error {
	res := r.db.WithContext(ctx).
		Model(&models.Budget{}).
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

// ListEnabledForCategory returns every enabled budget for the
// household that applies to a transaction with the given category —
// i.e. (category_id IS NULL) OR (category_id matches). Used by the
// evaluator after a transaction insert.
func (r *BudgetRepo) ListEnabledForCategory(ctx context.Context, householdID models.ID, categoryID *models.ID) ([]models.Budget, error) {
	q := r.db.WithContext(ctx).
		Where("household_id = ? AND enabled = TRUE", householdID)
	if categoryID == nil {
		q = q.Where("category_id IS NULL")
	} else {
		q = q.Where("category_id IS NULL OR category_id = ?", *categoryID)
	}
	var rows []models.Budget
	if err := q.Find(&rows).Error; err != nil {
		return nil, mapErr(err)
	}
	return rows, nil
}

// PeriodSpend returns total expenses in the budget's currency that
// would count against it for [from, to). Filters match the
// spending-by-category analytics (expense + not transfer + not
// deleted + not on a deleted account).
func (r *BudgetRepo) PeriodSpend(ctx context.Context, b *models.Budget, from, to time.Time) (decimal.Decimal, error) {
	var total decimal.NullDecimal
	q := r.db.WithContext(ctx).
		Table("transactions t").
		Where("t.household_id = ?", b.HouseholdID).
		Where("t.type = 'expense' AND t.transfer_id IS NULL AND t.deleted_at IS NULL").
		Where("t.currency = ?", b.Currency).
		Where("t.occurred_at >= ? AND t.occurred_at < ?", from, to).
		Where("EXISTS (SELECT 1 FROM accounts a WHERE a.id = t.account_id AND a.deleted_at IS NULL)")
	if b.CategoryID != nil {
		q = q.Where("t.category_id = ?", *b.CategoryID)
	}
	if err := q.Select("COALESCE(SUM(t.amount), 0)").Scan(&total).Error; err != nil {
		return decimal.Zero, mapErr(err)
	}
	if !total.Valid {
		return decimal.Zero, nil
	}
	return total.Decimal, nil
}

// FindAlert returns the alert row for the given (budget, period,
// threshold) or ErrNotFound. Used to short-circuit re-firing the
// same threshold within one period.
func (r *BudgetRepo) FindAlert(ctx context.Context, budgetID models.ID, periodStart time.Time, threshold int) (*models.BudgetAlert, error) {
	var a models.BudgetAlert
	err := r.db.WithContext(ctx).
		Where("budget_id = ? AND period_start = ? AND threshold_pct = ?", budgetID, periodStart, threshold).
		First(&a).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, mapErr(err)
	}
	return &a, nil
}

// InsertAlert idempotently records that a budget crossed a
// threshold. Conflicts on UNIQUE (budget_id, period_start,
// threshold_pct) surface as ErrConflict so the caller can skip
// delivery without retry.
func (r *BudgetRepo) InsertAlert(ctx context.Context, a *models.BudgetAlert) error {
	if err := r.db.WithContext(ctx).Create(a).Error; err != nil {
		return mapErr(err)
	}
	return nil
}

func (r *BudgetRepo) MarkDelivered(ctx context.Context, alertID models.ID) error {
	return r.db.WithContext(ctx).
		Model(&models.BudgetAlert{}).
		Where("id = ?", alertID).
		Update("delivered", true).Error
}
