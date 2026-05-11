package service

import (
	"context"
	"errors"
	"strings"

	"github.com/lib/pq"

	"github.com/mrbelka12000/hz_zachem/internal/models"
	"github.com/mrbelka12000/hz_zachem/internal/repo"
)

type RuleService struct {
	repo *repo.Repository
}

type CreateRuleInput struct {
	HouseholdID   models.ID
	Name          string
	MatchPatterns []string
	CategoryID    models.ID
	Priority      int
	Enabled       bool
	CreatedBy     models.ID
}

type UpdateRuleInput struct {
	HouseholdID   models.ID
	ID            models.ID
	Name          string
	MatchPatterns []string
	CategoryID    models.ID
	Priority      int
	Enabled       bool
}

func (s *RuleService) Create(ctx context.Context, in CreateRuleInput) (*models.CategorizationRule, error) {
	patterns, err := s.normalizePatterns(in.MatchPatterns)
	if err != nil {
		return nil, err
	}
	if err := s.ensureCategoryExists(ctx, in.HouseholdID, in.CategoryID); err != nil {
		return nil, err
	}
	if in.Priority < 0 {
		return nil, ErrInvalidInput
	}

	rule := &models.CategorizationRule{
		HouseholdID:   in.HouseholdID,
		Name:          strings.TrimSpace(in.Name),
		MatchPatterns: patterns,
		CategoryID:    in.CategoryID,
		Priority:      in.Priority,
		Enabled:       in.Enabled,
		CreatedBy:     in.CreatedBy,
	}
	if err := s.repo.Rules.Create(ctx, rule); err != nil {
		return nil, err
	}
	return rule, nil
}

func (s *RuleService) List(ctx context.Context, householdID models.ID) ([]models.CategorizationRule, error) {
	return s.repo.Rules.List(ctx, householdID)
}

func (s *RuleService) Get(ctx context.Context, householdID, id models.ID) (*models.CategorizationRule, error) {
	r, err := s.repo.Rules.GetByID(ctx, householdID, id)
	if err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return r, nil
}

func (s *RuleService) Update(ctx context.Context, in UpdateRuleInput) (*models.CategorizationRule, error) {
	patterns, err := s.normalizePatterns(in.MatchPatterns)
	if err != nil {
		return nil, err
	}
	if err := s.ensureCategoryExists(ctx, in.HouseholdID, in.CategoryID); err != nil {
		return nil, err
	}
	if in.Priority < 0 {
		return nil, ErrInvalidInput
	}

	rule := &models.CategorizationRule{
		ID:            in.ID,
		HouseholdID:   in.HouseholdID,
		Name:          strings.TrimSpace(in.Name),
		MatchPatterns: patterns,
		CategoryID:    in.CategoryID,
		Priority:      in.Priority,
		Enabled:       in.Enabled,
	}
	if err := s.repo.Rules.Update(ctx, rule); err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return s.Get(ctx, in.HouseholdID, in.ID)
}

func (s *RuleService) SoftDelete(ctx context.Context, householdID, id, deletedBy models.ID) error {
	if err := s.repo.Rules.SoftDelete(ctx, householdID, id, deletedBy); err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return ErrNotFound
		}
		return err
	}
	return nil
}

// MatchForTransaction is called by TransactionService.Create when the
// caller did not supply a manual category. Returns the rule whose
// patterns hit, or (nil, nil) if nothing matches.
func (s *RuleService) MatchForTransaction(ctx context.Context, householdID models.ID, merchant, description string) (*models.CategorizationRule, error) {
	rule, err := s.repo.Rules.Match(ctx, householdID, merchant, description)
	if err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return nil, nil //nolint:nilnil // "no match" is the documented contract
		}
		return nil, err
	}
	return rule, nil
}

// ApplyToUncategorized re-runs every rule against every uncategorized
// transaction in the household; returns the number of rows updated.
func (s *RuleService) ApplyToUncategorized(ctx context.Context, householdID models.ID) (int64, error) {
	return s.repo.Rules.ApplyToUncategorized(ctx, householdID)
}

// normalizePatterns lowercases, trims, and deduplicates patterns and
// rejects empty input or any pattern longer than 200 chars.
func (s *RuleService) normalizePatterns(raw []string) (pq.StringArray, error) {
	seen := make(map[string]struct{}, len(raw))
	out := make(pq.StringArray, 0, len(raw))
	for _, p := range raw {
		p = strings.ToLower(strings.TrimSpace(p))
		if p == "" {
			continue
		}
		if len(p) > 200 {
			return nil, ErrInvalidInput
		}
		if _, ok := seen[p]; ok {
			continue
		}
		seen[p] = struct{}{}
		out = append(out, p)
	}
	if len(out) == 0 {
		return nil, ErrInvalidInput
	}
	return out, nil
}

func (s *RuleService) ensureCategoryExists(ctx context.Context, householdID, categoryID models.ID) error {
	if categoryID == (models.ID{}) {
		return ErrInvalidInput
	}
	if _, err := s.repo.Categories.GetByID(ctx, householdID, categoryID); err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return ErrInvalidInput
		}
		return err
	}
	return nil
}
