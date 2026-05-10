package models

import (
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

type Money = decimal.Decimal

type ID = uuid.UUID

type AccountType string

const (
	AccountTypeCash  AccountType = "cash"
	AccountTypeCard  AccountType = "card"
	AccountTypeBank  AccountType = "bank"
	AccountTypeOther AccountType = "other"
)

func (t AccountType) Valid() bool {
	switch t {
	case AccountTypeCash, AccountTypeCard, AccountTypeBank, AccountTypeOther:
		return true
	}
	return false
}

type AccountStatus string

const (
	AccountStatusActive   AccountStatus = "active"
	AccountStatusArchived AccountStatus = "archived"
)

func (s AccountStatus) Valid() bool {
	return s == AccountStatusActive || s == AccountStatusArchived
}

type TransactionType string

const (
	TransactionTypeExpense    TransactionType = "expense"
	TransactionTypeIncome     TransactionType = "income"
	TransactionTypeTransfer   TransactionType = "transfer"
	TransactionTypeAdjustment TransactionType = "adjustment"
)

func (t TransactionType) Valid() bool {
	switch t {
	case TransactionTypeExpense, TransactionTypeIncome, TransactionTypeTransfer, TransactionTypeAdjustment:
		return true
	}
	return false
}

type TransactionSource string

const (
	TransactionSourceManual TransactionSource = "manual"
	TransactionSourceCSV    TransactionSource = "csv"
	TransactionSourceBot    TransactionSource = "bot"
)

type CategorySource string

const (
	CategorySourceNone   CategorySource = "none"
	CategorySourceManual CategorySource = "manual"
	CategorySourceRule   CategorySource = "rule"
	CategorySourceImport CategorySource = "import"
	CategorySourceSystem CategorySource = "system"
)

type TransferDirection string

const (
	TransferDirectionOut TransferDirection = "out" // money leaving this account (expense leg)
	TransferDirectionIn  TransferDirection = "in"  // money arriving in this account (income leg)
)

type Role string

const (
	RoleOwner  Role = "owner"
	RoleAdmin  Role = "admin"
	RoleMember Role = "member"
)

func (r Role) Valid() bool {
	return r == RoleOwner || r == RoleAdmin || r == RoleMember
}

func (r Role) CanManage() bool {
	return r == RoleOwner || r == RoleAdmin
}

type AuditFields struct {
	CreatedBy ID         `json:"created_by"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
	DeletedAt *time.Time `json:"deleted_at,omitempty"`
	DeletedBy *ID        `json:"deleted_by,omitempty"`
}
