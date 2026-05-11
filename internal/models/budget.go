package models

import (
	"time"

	"gorm.io/gorm"
)

type BudgetPeriod string

const (
	BudgetPeriodMonthly BudgetPeriod = "monthly"
)

func (p BudgetPeriod) Valid() bool {
	return p == BudgetPeriodMonthly
}

type Budget struct {
	ID          ID             `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	HouseholdID ID             `gorm:"type:uuid;not null" json:"household_id"`
	CategoryID  *ID            `gorm:"type:uuid" json:"category_id,omitempty"`
	Period      BudgetPeriod   `gorm:"not null;default:'monthly'" json:"period"`
	Amount      Money          `gorm:"type:numeric(18,2);not null" json:"amount"`
	Currency    string         `gorm:"not null" json:"currency"`
	StartsOn    time.Time      `gorm:"type:date;not null" json:"starts_on"`
	Enabled     bool           `gorm:"not null;default:true" json:"enabled"`
	Name        string         `gorm:"not null;default:''" json:"name"`
	CreatedBy   ID             `gorm:"type:uuid;not null" json:"created_by"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
	DeletedBy   *ID            `gorm:"type:uuid" json:"deleted_by,omitempty"`
}

func (Budget) TableName() string { return "budgets" }

// BudgetAlert is the idempotency marker that prevents a threshold
// from being re-fired within the same period. UNIQUE on
// (budget_id, period_start, threshold_pct).
type BudgetAlert struct {
	ID           ID        `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	BudgetID     ID        `gorm:"type:uuid;not null" json:"budget_id"`
	PeriodStart  time.Time `gorm:"type:date;not null" json:"period_start"`
	ThresholdPct int       `gorm:"not null" json:"threshold_pct"`
	FiredAt      time.Time `gorm:"not null;default:now()" json:"fired_at"`
	Delivered    bool      `gorm:"not null;default:false" json:"delivered"`
}

func (BudgetAlert) TableName() string { return "budget_alerts" }
