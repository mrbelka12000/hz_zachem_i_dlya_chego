package repo

import (
	"context"

	"gorm.io/gorm"

	"github.com/qazevent/hz_zachem/internal/models"
)

type HouseholdRepo struct {
	db *gorm.DB
}

func (r *HouseholdRepo) CreateWithOwner(ctx context.Context, h *models.Household, ownerID models.ID) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if h.CreatedBy == nil {
			cb := ownerID
			h.CreatedBy = &cb
		}
		if err := tx.Create(h).Error; err != nil {
			return mapErr(err)
		}
		member := models.HouseholdMember{
			UserID:      ownerID,
			HouseholdID: h.ID,
			Role:        models.RoleOwner,
		}
		if err := tx.Create(&member).Error; err != nil {
			return mapErr(err)
		}
		return nil
	})
}

func (r *HouseholdRepo) GetByID(ctx context.Context, id models.ID) (*models.Household, error) {
	var h models.Household
	if err := r.db.WithContext(ctx).First(&h, "id = ?", id).Error; err != nil {
		return nil, mapErr(err)
	}
	return &h, nil
}

func (r *HouseholdRepo) GetMembership(ctx context.Context, userID, householdID models.ID) (*models.HouseholdMember, error) {
	var m models.HouseholdMember
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND household_id = ?", userID, householdID).
		First(&m).Error
	if err != nil {
		return nil, mapErr(err)
	}
	return &m, nil
}

func (r *HouseholdRepo) ListUserHouseholds(ctx context.Context, userID models.ID) ([]models.Household, error) {
	var households []models.Household
	err := r.db.WithContext(ctx).
		Joins("INNER JOIN household_members hm ON hm.household_id = households.id").
		Where("hm.user_id = ?", userID).
		Find(&households).Error
	if err != nil {
		return nil, mapErr(err)
	}
	return households, nil
}

func (r *HouseholdRepo) PrimaryHouseholdID(ctx context.Context, userID models.ID) (models.ID, error) {
	var m models.HouseholdMember
	err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Order("joined_at ASC").
		First(&m).Error
	if err != nil {
		return models.ID{}, mapErr(err)
	}
	return m.HouseholdID, nil
}
