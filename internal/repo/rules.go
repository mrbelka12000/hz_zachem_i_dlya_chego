package repo

import (
	"context"

	"gorm.io/gorm"

	"github.com/mrbelka12000/hz_zachem/internal/models"
)

type RuleRepo struct {
	db *gorm.DB
}

func (r *RuleRepo) Create(ctx context.Context, rule *models.CategorizationRule) error {
	if err := r.db.WithContext(ctx).Create(rule).Error; err != nil {
		return mapErr(err)
	}
	return nil
}

func (r *RuleRepo) GetByID(ctx context.Context, householdID, id models.ID) (*models.CategorizationRule, error) {
	var rule models.CategorizationRule
	err := r.db.WithContext(ctx).
		Where("household_id = ? AND id = ?", householdID, id).
		First(&rule).Error
	if err != nil {
		return nil, mapErr(err)
	}
	return &rule, nil
}

func (r *RuleRepo) List(ctx context.Context, householdID models.ID) ([]models.CategorizationRule, error) {
	var rules []models.CategorizationRule
	err := r.db.WithContext(ctx).
		Where("household_id = ?", householdID).
		Order("priority ASC, created_at ASC").
		Find(&rules).Error
	if err != nil {
		return nil, mapErr(err)
	}
	return rules, nil
}

func (r *RuleRepo) Update(ctx context.Context, rule *models.CategorizationRule) error {
	res := r.db.WithContext(ctx).
		Model(&models.CategorizationRule{}).
		Where("household_id = ? AND id = ?", rule.HouseholdID, rule.ID).
		Updates(map[string]any{
			"name":           rule.Name,
			"match_patterns": rule.MatchPatterns,
			"category_id":    rule.CategoryID,
			"priority":       rule.Priority,
			"enabled":        rule.Enabled,
			"updated_at":     gorm.Expr("NOW()"),
		})
	if res.Error != nil {
		return mapErr(res.Error)
	}
	if res.RowsAffected == 0 {
		return ErrNotFound
	}
	return nil
}

func (r *RuleRepo) SoftDelete(ctx context.Context, householdID, id, deletedBy models.ID) error {
	res := r.db.WithContext(ctx).
		Model(&models.CategorizationRule{}).
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

// Match returns the highest-priority enabled rule whose patterns
// appear (case-insensitive substring) inside the supplied merchant
// or description, or ErrNotFound if nothing matches. Patterns in the
// table are stored lowercased by the service layer so the SQL match
// only needs to lower the transaction fields.
func (r *RuleRepo) Match(ctx context.Context, householdID models.ID, merchant, description string) (*models.CategorizationRule, error) {
	var rule models.CategorizationRule
	err := r.db.WithContext(ctx).Raw(`
		SELECT *
		FROM categorization_rules r
		WHERE r.household_id = ?
		  AND r.deleted_at IS NULL
		  AND r.enabled = TRUE
		  AND EXISTS (
		      SELECT 1 FROM unnest(r.match_patterns) AS p
		      WHERE position(p IN lower(?)) > 0
		         OR position(p IN lower(?)) > 0
		  )
		ORDER BY r.priority ASC, r.created_at ASC
		LIMIT 1
	`, householdID, merchant, description).Scan(&rule).Error
	if err != nil {
		return nil, mapErr(err)
	}
	if rule.ID == (models.ID{}) {
		return nil, ErrNotFound
	}
	return &rule, nil
}

// ApplyToUncategorized scans every uncategorized transaction in the
// household and assigns the winning rule's category. Manual
// categorizations (category_id IS NOT NULL) are left alone. Returns
// the number of rows updated.
func (r *RuleRepo) ApplyToUncategorized(ctx context.Context, householdID models.ID) (int64, error) {
	res := r.db.WithContext(ctx).Exec(`
		UPDATE transactions t
		SET category_id = m.category_id,
		    category_source = 'rule',
		    categorization_rule_id = m.id,
		    updated_at = NOW()
		FROM LATERAL (
		    SELECT r.id, r.category_id
		    FROM categorization_rules r
		    WHERE r.household_id = t.household_id
		      AND r.deleted_at IS NULL
		      AND r.enabled = TRUE
		      AND EXISTS (
		          SELECT 1 FROM unnest(r.match_patterns) AS p
		          WHERE position(p IN lower(t.merchant)) > 0
		             OR position(p IN lower(t.description)) > 0
		      )
		    ORDER BY r.priority ASC, r.created_at ASC
		    LIMIT 1
		) m
		WHERE t.household_id = ?
		  AND t.category_id IS NULL
		  AND t.deleted_at IS NULL
	`, householdID)
	if res.Error != nil {
		return 0, mapErr(res.Error)
	}
	return res.RowsAffected, nil
}
