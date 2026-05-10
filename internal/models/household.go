package models

import (
	"time"

	"gorm.io/gorm"
)

type Household struct {
	ID           ID             `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	Name         string         `gorm:"not null" json:"name"`
	BaseCurrency string         `gorm:"not null;default:'KZT'" json:"base_currency"`
	Timezone     string         `gorm:"not null;default:'Asia/Almaty'" json:"timezone"`
	CreatedBy    *ID            `gorm:"type:uuid" json:"created_by,omitempty"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
	DeletedBy    *ID            `gorm:"type:uuid" json:"deleted_by,omitempty"`
}

func (Household) TableName() string { return "households" }

type HouseholdMember struct {
	UserID      ID        `gorm:"type:uuid;primaryKey" json:"user_id"`
	HouseholdID ID        `gorm:"type:uuid;primaryKey" json:"household_id"`
	Role        Role      `gorm:"not null" json:"role"`
	JoinedAt    time.Time `gorm:"not null;default:now()" json:"joined_at"`
}

func (HouseholdMember) TableName() string { return "household_members" }

type HouseholdInvite struct {
	ID          ID        `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	HouseholdID ID        `gorm:"type:uuid;not null" json:"household_id"`
	Code        string    `gorm:"not null;uniqueIndex" json:"code"`
	CreatedBy   ID        `gorm:"type:uuid;not null" json:"created_by"`
	MaxUses     int       `gorm:"not null;default:1" json:"max_uses"`
	UsedCount   int       `gorm:"not null;default:0" json:"used_count"`
	ExpiresAt   time.Time `gorm:"not null" json:"expires_at"`
	CreatedAt   time.Time `json:"created_at"`
}

func (HouseholdInvite) TableName() string { return "household_invites" }

func (i HouseholdInvite) Available(now time.Time) bool {
	return i.UsedCount < i.MaxUses && now.Before(i.ExpiresAt)
}
