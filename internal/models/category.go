package models

import (
	"time"

	"gorm.io/gorm"
)

type Category struct {
	ID          ID             `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	HouseholdID ID             `gorm:"type:uuid;not null" json:"household_id"`
	ParentID    *ID            `gorm:"type:uuid" json:"parent_id,omitempty"`
	Name        string         `gorm:"not null" json:"name"`
	Icon        string         `gorm:"not null;default:''" json:"icon"`
	Color       string         `gorm:"not null;default:''" json:"color"`
	CreatedBy   ID             `gorm:"type:uuid;not null" json:"created_by"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
	DeletedBy   *ID            `gorm:"type:uuid" json:"deleted_by,omitempty"`
}

func (Category) TableName() string { return "categories" }

type CategorizationRule struct {
	ID           ID             `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	HouseholdID  ID             `gorm:"type:uuid;not null" json:"household_id"`
	MatchField   string         `gorm:"not null" json:"match_field"`
	MatchPattern string         `gorm:"not null" json:"match_pattern"`
	CategoryID   ID             `gorm:"type:uuid;not null" json:"category_id"`
	Priority     int            `gorm:"not null;default:100" json:"priority"`
	CreatedBy    ID             `gorm:"type:uuid;not null" json:"created_by"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
	DeletedBy    *ID            `gorm:"type:uuid" json:"deleted_by,omitempty"`
}

func (CategorizationRule) TableName() string { return "categorization_rules" }
