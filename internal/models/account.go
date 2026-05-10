package models

import (
	"time"

	"gorm.io/gorm"
)

type Account struct {
	ID             ID             `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	HouseholdID    ID             `gorm:"type:uuid;not null;uniqueIndex:accounts_id_household_uq,priority:2" json:"household_id"`
	Name           string         `gorm:"not null" json:"name"`
	Type           AccountType    `gorm:"not null" json:"type"`
	Currency       string         `gorm:"not null" json:"currency"`
	InitialBalance Money          `gorm:"type:numeric(18,2);not null;default:0" json:"initial_balance"`
	Status         AccountStatus  `gorm:"not null;default:'active'" json:"status"`
	CreatedBy      ID             `gorm:"type:uuid;not null" json:"created_by"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
	DeletedBy      *ID            `gorm:"type:uuid" json:"deleted_by,omitempty"`
}

func (Account) TableName() string { return "accounts" }

func (a Account) IsActive() bool {
	return a.Status == AccountStatusActive && !a.DeletedAt.Valid
}
