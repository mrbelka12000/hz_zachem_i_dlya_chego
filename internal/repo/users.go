package repo

import (
	"context"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"

	"github.com/qazevent/hz_zachem/internal/models"
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
