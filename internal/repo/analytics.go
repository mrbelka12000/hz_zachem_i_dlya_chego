package repo

import (
	"context"
	"time"

	"gorm.io/gorm"

	"github.com/qazevent/hz_zachem/internal/models"
)

type AnalyticsRepo struct {
	db *gorm.DB
}

type CategorySpendRow struct {
	CategoryID   *models.ID   `json:"category_id"`
	CategoryName string       `json:"category_name"`
	Total        models.Money `json:"total"`
	Count        int64        `json:"count"`
}

type MonthSpendRow struct {
	Month time.Time    `json:"month"`
	Total models.Money `json:"total"`
	Count int64        `json:"count"`
}

type MerchantSpendRow struct {
	Merchant string       `json:"merchant"`
	Total    models.Money `json:"total"`
	Count    int64        `json:"count"`
}

const excludeNonSpending = `
		AND t.type = 'expense'
		AND t.transfer_id IS NULL
		AND t.deleted_at IS NULL
	`

func (r *AnalyticsRepo) SpendingByCategory(ctx context.Context, householdID models.ID, from, to time.Time) ([]CategorySpendRow, error) {
	var rows []CategorySpendRow
	err := r.db.WithContext(ctx).Raw(`
		SELECT
			t.category_id,
			COALESCE(c.name, 'Uncategorized') AS category_name,
			SUM(t.amount) AS total,
			COUNT(*) AS count
		FROM transactions t
		LEFT JOIN categories c ON c.id = t.category_id AND c.deleted_at IS NULL
		WHERE t.household_id = ?
		  AND t.occurred_at >= ?
		  AND t.occurred_at < ?
		  `+excludeNonSpending+`
		GROUP BY t.category_id, c.name
		ORDER BY total DESC
	`, householdID, from, to).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	return rows, nil
}

func (r *AnalyticsRepo) SpendingByMonth(ctx context.Context, householdID models.ID, timezone string, from, to time.Time) ([]MonthSpendRow, error) {
	var rows []MonthSpendRow
	err := r.db.WithContext(ctx).Raw(`
		SELECT
			date_trunc('month', t.occurred_at AT TIME ZONE ?) AS month,
			SUM(t.amount) AS total,
			COUNT(*) AS count
		FROM transactions t
		WHERE t.household_id = ?
		  AND t.occurred_at >= ?
		  AND t.occurred_at < ?
		  `+excludeNonSpending+`
		GROUP BY month
		ORDER BY month ASC
	`, timezone, householdID, from, to).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	return rows, nil
}

func (r *AnalyticsRepo) TopMerchants(ctx context.Context, householdID models.ID, from, to time.Time, limit int) ([]MerchantSpendRow, error) {
	if limit <= 0 {
		limit = 10
	}
	var rows []MerchantSpendRow
	err := r.db.WithContext(ctx).Raw(`
		SELECT
			lower(t.merchant) AS merchant,
			SUM(t.amount) AS total,
			COUNT(*) AS count
		FROM transactions t
		WHERE t.household_id = ?
		  AND t.occurred_at >= ?
		  AND t.occurred_at < ?
		  AND t.merchant <> ''
		  `+excludeNonSpending+`
		GROUP BY lower(t.merchant)
		ORDER BY total DESC
		LIMIT ?
	`, householdID, from, to, limit).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	return rows, nil
}

var _ = gorm.ErrRecordNotFound
