package models

import (
	"time"

	"github.com/lib/pq"
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

// CategorizationRule auto-assigns a category to a transaction when
// any of MatchPatterns appears (case-insensitive substring) inside
// the transaction's merchant or description. Patterns are stored
// lowercased by the service layer so the SQL match can avoid an
// extra lower() call per row.
type CategorizationRule struct {
	ID            ID             `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	HouseholdID   ID             `gorm:"type:uuid;not null" json:"household_id"`
	Name          string         `gorm:"not null;default:''" json:"name"`
	MatchPatterns pq.StringArray `gorm:"type:text[];not null" json:"match_patterns"`
	CategoryID    ID             `gorm:"type:uuid;not null" json:"category_id"`
	Priority      int            `gorm:"not null;default:100" json:"priority"`
	Enabled       bool           `gorm:"not null;default:true" json:"enabled"`
	CreatedBy     ID             `gorm:"type:uuid;not null" json:"created_by"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
	DeletedBy     *ID            `gorm:"type:uuid" json:"deleted_by,omitempty"`
}

func (CategorizationRule) TableName() string { return "categorization_rules" }
