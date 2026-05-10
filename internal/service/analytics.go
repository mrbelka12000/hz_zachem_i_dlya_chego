package service

import (
	"context"
	"time"

	"github.com/mrbelka12000/hz_zachem/internal/models"
	"github.com/mrbelka12000/hz_zachem/internal/repo"
)

type AnalyticsService struct {
	repo       *repo.Repository
	households *HouseholdService
}

func (s *AnalyticsService) SpendingByCategory(ctx context.Context, householdID models.ID, from, to time.Time) ([]repo.CategorySpendRow, error) {
	if from.IsZero() || to.IsZero() || !to.After(from) {
		return nil, ErrInvalidInput
	}
	return s.repo.Analytics.SpendingByCategory(ctx, householdID, from, to)
}

func (s *AnalyticsService) SpendingByMonth(ctx context.Context, householdID models.ID, months int) ([]repo.MonthSpendRow, error) {
	if months <= 0 || months > 36 {
		return nil, ErrInvalidInput
	}
	h, err := s.households.Get(ctx, householdID)
	if err != nil {
		return nil, err
	}
	loc, err := time.LoadLocation(h.Timezone)
	if err != nil {
		loc = time.UTC
	}
	now := time.Now().In(loc)
	to := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, loc)
	from := time.Date(now.Year(), now.Month()-time.Month(months-1), 1, 0, 0, 0, 0, loc)
	return s.repo.Analytics.SpendingByMonth(ctx, householdID, h.Timezone, from, to)
}

func (s *AnalyticsService) TopMerchants(ctx context.Context, householdID models.ID, from, to time.Time, limit int) ([]repo.MerchantSpendRow, error) {
	if from.IsZero() || to.IsZero() || !to.After(from) {
		return nil, ErrInvalidInput
	}
	return s.repo.Analytics.TopMerchants(ctx, householdID, from, to, limit)
}

func (s *AnalyticsService) IncomeByCategory(ctx context.Context, householdID models.ID, from, to time.Time) ([]repo.CategorySpendRow, error) {
	if from.IsZero() || to.IsZero() || !to.After(from) {
		return nil, ErrInvalidInput
	}
	return s.repo.Analytics.IncomeByCategory(ctx, householdID, from, to)
}

func (s *AnalyticsService) CashflowByMonth(ctx context.Context, householdID models.ID, months int) ([]repo.CashflowMonthRow, error) {
	if months <= 0 || months > 36 {
		return nil, ErrInvalidInput
	}
	h, err := s.households.Get(ctx, householdID)
	if err != nil {
		return nil, err
	}
	loc, err := time.LoadLocation(h.Timezone)
	if err != nil {
		loc = time.UTC
	}
	now := time.Now().In(loc)
	to := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, loc)
	from := time.Date(now.Year(), now.Month()-time.Month(months-1), 1, 0, 0, 0, 0, loc)
	return s.repo.Analytics.CashflowByMonth(ctx, householdID, h.Timezone, from, to)
}

// AccountCashflowByMonth scopes cashflow to a single account; transfer
// legs are folded into expense/income via transfer_direction so the
// chart reflects what actually moved through the account.
func (s *AnalyticsService) AccountCashflowByMonth(ctx context.Context, householdID, accountID models.ID, months int) ([]repo.CashflowMonthRow, error) {
	if months <= 0 || months > 36 {
		return nil, ErrInvalidInput
	}
	h, err := s.households.Get(ctx, householdID)
	if err != nil {
		return nil, err
	}
	loc, err := time.LoadLocation(h.Timezone)
	if err != nil {
		loc = time.UTC
	}
	now := time.Now().In(loc)
	to := time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, loc)
	from := time.Date(now.Year(), now.Month()-time.Month(months-1), 1, 0, 0, 0, 0, loc)
	return s.repo.Analytics.AccountCashflowByMonth(ctx, householdID, accountID, h.Timezone, from, to)
}
