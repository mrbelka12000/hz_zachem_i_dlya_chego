package repo

import (
	"context"

	"gorm.io/gorm"
)

type Repository struct {
	db *gorm.DB

	Users        *UserRepo
	Households   *HouseholdRepo
	Accounts     *AccountRepo
	Categories   *CategoryRepo
	Transactions *TransactionRepo
	Analytics    *AnalyticsRepo
	Rules        *RuleRepo
	Budgets      *BudgetRepo
}

func New(db *gorm.DB) *Repository {
	return &Repository{
		db:           db,
		Users:        &UserRepo{db: db},
		Households:   &HouseholdRepo{db: db},
		Accounts:     &AccountRepo{db: db},
		Categories:   &CategoryRepo{db: db},
		Transactions: &TransactionRepo{db: db},
		Analytics:    &AnalyticsRepo{db: db},
		Rules:        &RuleRepo{db: db},
		Budgets:      &BudgetRepo{db: db},
	}
}

func (r *Repository) DB() *gorm.DB { return r.db }

func (r *Repository) Ping(ctx context.Context) error {
	sqlDB, err := r.db.DB()
	if err != nil {
		return err
	}
	return sqlDB.PingContext(ctx)
}
