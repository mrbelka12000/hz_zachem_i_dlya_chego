package repo

import (
	"context"

	"gorm.io/gorm"

	"github.com/qazevent/hz_zachem/internal/models"
)

type AccountRepo struct {
	db *gorm.DB
}

func (r *AccountRepo) Create(ctx context.Context, a *models.Account) error {
	if err := r.db.WithContext(ctx).Create(a).Error; err != nil {
		return mapErr(err)
	}
	return nil
}

func (r *AccountRepo) GetByID(ctx context.Context, householdID, id models.ID) (*models.Account, error) {
	var a models.Account
	err := r.db.WithContext(ctx).
		Where("household_id = ? AND id = ?", householdID, id).
		First(&a).Error
	if err != nil {
		return nil, mapErr(err)
	}
	return &a, nil
}

func (r *AccountRepo) List(ctx context.Context, householdID models.ID, includeArchived bool) ([]models.Account, error) {
	var accounts []models.Account
	q := r.db.WithContext(ctx).Where("household_id = ?", householdID)
	if !includeArchived {
		q = q.Where("status = ?", models.AccountStatusActive)
	}
	if err := q.Order("name ASC").Find(&accounts).Error; err != nil {
		return nil, mapErr(err)
	}
	return accounts, nil
}

func (r *AccountRepo) Update(ctx context.Context, a *models.Account) error {
	res := r.db.WithContext(ctx).
		Model(&models.Account{}).
		Where("household_id = ? AND id = ?", a.HouseholdID, a.ID).
		Updates(map[string]any{
			"name":            a.Name,
			"type":            a.Type,
			"currency":        a.Currency,
			"initial_balance": a.InitialBalance,
			"updated_at":      gorm.Expr("NOW()"),
		})
	if res.Error != nil {
		return mapErr(res.Error)
	}
	if res.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *AccountRepo) SetStatus(ctx context.Context, householdID, id models.ID, status models.AccountStatus) error {
	res := r.db.WithContext(ctx).
		Model(&models.Account{}).
		Where("household_id = ? AND id = ?", householdID, id).
		Updates(map[string]any{
			"status":     status,
			"updated_at": gorm.Expr("NOW()"),
		})
	if res.Error != nil {
		return mapErr(res.Error)
	}
	if res.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *AccountRepo) SoftDelete(ctx context.Context, householdID, id, deletedBy models.ID) error {
	res := r.db.WithContext(ctx).
		Model(&models.Account{}).
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
