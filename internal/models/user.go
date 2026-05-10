package models

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	ID             ID             `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Email          string         `gorm:"not null" json:"email"`
	PasswordHash   string         `gorm:"not null" json:"-"`
	TelegramUserID *int64         `json:"telegram_user_id,omitempty"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
	DeletedBy      *ID            `gorm:"type:uuid" json:"deleted_by,omitempty"`
}

func (User) TableName() string { return "users" }

type RefreshToken struct {
	ID        ID         `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	UserID    ID         `gorm:"type:uuid;not null;index" json:"user_id"`
	TokenHash string     `gorm:"not null;uniqueIndex" json:"-"`
	ExpiresAt time.Time  `gorm:"not null" json:"expires_at"`
	RevokedAt *time.Time `json:"revoked_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

func (RefreshToken) TableName() string { return "refresh_tokens" }
