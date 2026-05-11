package repo

import (
	"context"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"

	"github.com/mrbelka12000/hz_zachem/internal/models"
)

type UserRepo struct {
	db *gorm.DB
}

func (r *UserRepo) Create(ctx context.Context, user *models.User) error {
	if err := r.db.WithContext(ctx).Create(user).Error; err != nil {
		return mapErr(err)
	}
	return nil
}

func (r *UserRepo) GetByID(ctx context.Context, id models.ID) (*models.User, error) {
	var user models.User
	if err := r.db.WithContext(ctx).First(&user, "id = ?", id).Error; err != nil {
		return nil, mapErr(err)
	}
	return &user, nil
}

func (r *UserRepo) GetByEmail(ctx context.Context, email string) (*models.User, error) {
	var user models.User
	err := r.db.WithContext(ctx).
		Where("lower(email) = ?", strings.ToLower(email)).
		First(&user).Error
	if err != nil {
		return nil, mapErr(err)
	}
	return &user, nil
}

func (r *UserRepo) StoreRefreshToken(ctx context.Context, token *models.RefreshToken) error {
	if err := r.db.WithContext(ctx).Create(token).Error; err != nil {
		return mapErr(err)
	}
	return nil
}

func (r *UserRepo) FindActiveRefreshToken(ctx context.Context, hash string) (*models.RefreshToken, error) {
	var token models.RefreshToken
	err := r.db.WithContext(ctx).
		Where("token_hash = ? AND revoked_at IS NULL AND expires_at > ?", hash, time.Now()).
		First(&token).Error
	if err != nil {
		return nil, mapErr(err)
	}
	return &token, nil
}

// UpdateTelegramUserID writes (or clears) the user's Telegram chat ID.
// Used by the Settings page so the budget notifier knows where to
// send alerts. nil clears the link.
func (r *UserRepo) UpdateTelegramUserID(ctx context.Context, userID models.ID, chatID *int64) error {
	res := r.db.WithContext(ctx).
		Model(&models.User{}).
		Where("id = ?", userID).
		Updates(map[string]any{
			"telegram_user_id": chatID,
			"updated_at":       gorm.Expr("NOW()"),
		})
	if res.Error != nil {
		return mapErr(res.Error)
	}
	if res.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

// ListHouseholdMembersWithTelegram returns every member of the
// household that has a non-NULL telegram_user_id. Used to fan out
// budget alerts to all linked household members.
func (r *UserRepo) ListHouseholdMembersWithTelegram(ctx context.Context, householdID models.ID) ([]models.User, error) {
	var users []models.User
	err := r.db.WithContext(ctx).
		Joins("JOIN household_members hm ON hm.user_id = users.id").
		Where("hm.household_id = ? AND users.telegram_user_id IS NOT NULL AND users.deleted_at IS NULL", householdID).
		Find(&users).Error
	if err != nil {
		return nil, mapErr(err)
	}
	return users, nil
}

func (r *UserRepo) RevokeRefreshToken(ctx context.Context, id models.ID) error {
	now := time.Now()
	res := r.db.WithContext(ctx).
		Model(&models.RefreshToken{}).
		Where("id = ? AND revoked_at IS NULL", id).
		Update("revoked_at", now)
	if res.Error != nil {
		return mapErr(res.Error)
	}
	if res.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

func mapErr(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return ErrNotFound
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return ErrConflict
	}
	return err
}
