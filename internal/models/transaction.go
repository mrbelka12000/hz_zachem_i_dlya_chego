package models

import (
	"encoding/json"
	"time"

	"gorm.io/gorm"
)

type Transaction struct {
	ID                   ID                `gorm:"type:uuid;primaryKey;default:gen_random_uuid()" json:"id"`
	HouseholdID          ID                `gorm:"type:uuid;not null" json:"household_id"`
	AccountID            ID                `gorm:"type:uuid;not null" json:"account_id"`
	Type                 TransactionType   `gorm:"not null" json:"type"`
	Amount               Money             `gorm:"type:numeric(18,2);not null" json:"amount"`
	Currency             string            `gorm:"not null" json:"currency"`
	OccurredAt           time.Time         `gorm:"not null" json:"occurred_at"`
	Description          string            `gorm:"not null;default:''" json:"description"`
	Merchant             string            `gorm:"not null;default:''" json:"merchant"`
	CategoryID           *ID               `gorm:"type:uuid" json:"category_id,omitempty"`
	CategorySource       CategorySource    `gorm:"not null;default:'none'" json:"category_source"`
	CategorizationRuleID *ID               `gorm:"type:uuid;column:categorization_rule_id" json:"categorization_rule_id,omitempty"`
	Source               TransactionSource `gorm:"not null;default:'manual'" json:"source"`
	ExternalID           *string           `json:"external_id,omitempty"`
	ExternalHash         *string           `json:"external_hash,omitempty"`
	RawPayload           json.RawMessage   `gorm:"type:jsonb" json:"raw_payload,omitempty"`
	TransferID           *ID               `gorm:"type:uuid;index" json:"transfer_id,omitempty"`
	TransferDirection    *TransferDirection `gorm:"type:text" json:"transfer_direction,omitempty"`
	IdempotencyKey       *string           `json:"idempotency_key,omitempty"`
	CreatedBy            ID                `gorm:"type:uuid;not null" json:"created_by"`
	UpdatedBy            *ID               `gorm:"type:uuid" json:"updated_by,omitempty"`
	CreatedAt            time.Time         `json:"created_at"`
	UpdatedAt            time.Time         `json:"updated_at"`
	DeletedAt            gorm.DeletedAt    `gorm:"index" json:"deleted_at,omitempty"`
	DeletedBy            *ID               `gorm:"type:uuid" json:"deleted_by,omitempty"`

	// Counterpart is populated by the service layer when fetching a
	// single transfer leg's detail. It is never persisted (gorm:"-").
	Counterpart *Transaction `gorm:"-" json:"counterpart,omitempty"`
}

func (Transaction) TableName() string { return "transactions" }

func (t Transaction) IsTransferLeg() bool {
	return t.TransferID != nil
}
