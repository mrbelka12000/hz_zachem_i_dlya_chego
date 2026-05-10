package repo

import (
	"context"

	"gorm.io/gorm"

	"github.com/mrbelka12000/hz_zachem/internal/models"
)

type CategoryRepo struct {
	db *gorm.DB
}

func (r *CategoryRepo) Create(ctx context.Context, c *models.Category) error {
	if err := r.db.WithContext(ctx).Create(c).Error; err != nil {
		return mapErr(err)
	}
	return nil
}

func (r *CategoryRepo) GetByID(ctx context.Context, householdID, id models.ID) (*models.Category, error) {
	var c models.Category
	err := r.db.WithContext(ctx).
		Where("household_id = ? AND id = ?", householdID, id).
		First(&c).Error
	if err != nil {
		return nil, mapErr(err)
	}
	return &c, nil
}

func (r *CategoryRepo) List(ctx context.Context, householdID models.ID) ([]models.Category, error) {
	var categories []models.Category
	err := r.db.WithContext(ctx).
		Where("household_id = ?", householdID).
		Order("name ASC").
		Find(&categories).Error
	if err != nil {
		return nil, mapErr(err)
	}
	return categories, nil
}

func (r *CategoryRepo) Update(ctx context.Context, c *models.Category) error {
	res := r.db.WithContext(ctx).
		Model(&models.Category{}).
		Where("household_id = ? AND id = ?", c.HouseholdID, c.ID).
		Updates(map[string]any{
			"name":       c.Name,
			"icon":       c.Icon,
			"color":      c.Color,
			"parent_id":  c.ParentID,
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

func (r *CategoryRepo) SoftDelete(ctx context.Context, householdID, id, deletedBy models.ID) error {
	res := r.db.WithContext(ctx).
		Model(&models.Category{}).
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
