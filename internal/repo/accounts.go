package repo

import (
	"context"

	"gorm.io/gorm"

	"github.com/mrbelka12000/hz_zachem/internal/models"
)

type AccountRepo struct {
	db *gorm.DB
}

func (r *AccountRepo) Create(ctx context.Context, a *models.Account) error {
	if err := r.db.WithContext(ctx).Create(a).Error; err != nil {
		return mapErr(err)
	}
	return nil
}

func (r *AccountRepo) GetByID(ctx context.Context, householdID, id models.ID) (*models.Account, error) {
	var a models.Account
	err := r.db.WithContext(ctx).
		Where("household_id = ? AND id = ?", householdID, id).
		First(&a).Error
	if err != nil {
		return nil, mapErr(err)
	}
	return &a, nil
}

func (r *AccountRepo) List(ctx context.Context, householdID models.ID, includeArchived bool) ([]models.Account, error) {
	var accounts []models.Account
	q := r.db.WithContext(ctx).Where("household_id = ?", householdID)
	if !includeArchived {
		q = q.Where("status = ?", models.AccountStatusActive)
	}
	if err := q.Order("name ASC").Find(&accounts).Error; err != nil {
		return nil, mapErr(err)
	}
	return accounts, nil
}

func (r *AccountRepo) Update(ctx context.Context, a *models.Account) error {
	res := r.db.WithContext(ctx).
		Model(&models.Account{}).
		Where("household_id = ? AND id = ?", a.HouseholdID, a.ID).
		Updates(map[string]any{
			"name":            a.Name,
			"type":            a.Type,
			"currency":        a.Currency,
			"initial_balance": a.InitialBalance,
			"updated_at":      gorm.Expr("NOW()"),
		})
	if res.Error != nil {
		return mapErr(res.Error)
	}
	if res.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *AccountRepo) SetStatus(ctx context.Context, householdID, id models.ID, status models.AccountStatus) error {
	res := r.db.WithContext(ctx).
		Model(&models.Account{}).
		Where("household_id = ? AND id = ?", householdID, id).
		Updates(map[string]any{
			"status":     status,
			"updated_at": gorm.Expr("NOW()"),
		})
	if res.Error != nil {
		return mapErr(res.Error)
	}
	if res.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

// Balance is initial_balance + signed sum of non-deleted transactions
// on this account: incomes and 'in' transfers add, expenses and 'out'
// transfers subtract. Adjustments are skipped because their sign is
// caller-defined and not stored on the row.
func (r *AccountRepo) Balance(ctx context.Context, householdID, accountID models.ID) (models.Money, error) {
	var balance models.Money
	err := r.db.WithContext(ctx).Raw(`
		SELECT a.initial_balance + COALESCE((
			SELECT SUM(CASE
				WHEN t.type = 'income' OR (t.type = 'transfer' AND t.transfer_direction = 'in') THEN t.amount
				WHEN t.type = 'expense' OR (t.type = 'transfer' AND t.transfer_direction = 'out') THEN -t.amount
				ELSE 0 END)
			FROM transactions t
			WHERE t.account_id = a.id
			  AND t.household_id = a.household_id
			  AND t.deleted_at IS NULL
		), 0) AS balance
		FROM accounts a
		WHERE a.id = ?
		  AND a.household_id = ?
		  AND a.deleted_at IS NULL
	`, accountID, householdID).Scan(&balance).Error
	if err != nil {
		return models.Money{}, mapErr(err)
	}
	return balance, nil
}

// AccountBalanceRow is one account's current balance, returned by
// Balances for the Dashboard's "total balance" widget. Currency is
// the account's own — the SPA folds them to KZT at display time.
type AccountBalanceRow struct {
	AccountID models.ID            `json:"account_id"`
	Name      string               `json:"name"`
	Currency  string               `json:"currency"`
	Status    models.AccountStatus `json:"status"`
	Balance   models.Money         `json:"balance"`
}

// Balances returns the current balance per non-deleted account in
// the household in a single query — avoids the N+1 the SPA would
// otherwise hit calling /v1/accounts/:id/balance for each account.
// Same signed-sum rule as Balance().
func (r *AccountRepo) Balances(ctx context.Context, householdID models.ID, includeArchived bool) ([]AccountBalanceRow, error) {
	var rows []AccountBalanceRow
	q := r.db.WithContext(ctx).Raw(`
		SELECT
			a.id AS account_id,
			a.name,
			a.currency,
			a.status,
			a.initial_balance + COALESCE((
				SELECT SUM(CASE
					WHEN t.type = 'income' OR (t.type = 'transfer' AND t.transfer_direction = 'in') THEN t.amount
					WHEN t.type = 'expense' OR (t.type = 'transfer' AND t.transfer_direction = 'out') THEN -t.amount
					ELSE 0 END)
				FROM transactions t
				WHERE t.account_id = a.id
				  AND t.household_id = a.household_id
				  AND t.deleted_at IS NULL
			), 0) AS balance
		FROM accounts a
		WHERE a.household_id = ?
		  AND a.deleted_at IS NULL
		  AND (? OR a.status = 'active')
		ORDER BY a.name ASC
	`, householdID, includeArchived)
	if err := q.Scan(&rows).Error; err != nil {
		return nil, mapErr(err)
	}
	return rows, nil
}

func (r *AccountRepo) SoftDelete(ctx context.Context, householdID, id, deletedBy models.ID) error {
	res := r.db.WithContext(ctx).
		Model(&models.Account{}).
		Where("household_id = ? AND id = ?", householdID, id).
		Updates(map[string]any{
			"deleted_at": gorm.Expr("NOW()"),
			"deleted_by": deletedBy,
		})
	if res.Error != nil {
		return mapErr(res.Error)
	}
	if res.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}
