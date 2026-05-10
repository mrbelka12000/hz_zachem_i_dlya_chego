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
	tz, from, to, err := s.monthRange(ctx, householdID, months)
	if err != nil {
		return nil, err
	}
	return s.repo.Analytics.SpendingByMonth(ctx, householdID, tz, from, to)
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
	tz, from, to, err := s.monthRange(ctx, householdID, months)
	if err != nil {
		return nil, err
	}
	return s.repo.Analytics.CashflowByMonth(ctx, householdID, tz, from, to)
}

// AccountCashflowByMonth scopes cashflow to a single account; transfer
// legs are folded into expense/income via transfer_direction so the
// chart reflects what actually moved through the account.
func (s *AnalyticsService) AccountCashflowByMonth(ctx context.Context, householdID, accountID models.ID, months int) ([]repo.CashflowMonthRow, error) {
	tz, from, to, err := s.monthRange(ctx, householdID, months)
	if err != nil {
		return nil, err
	}
	return s.repo.Analytics.AccountCashflowByMonth(ctx, householdID, accountID, tz, from, to)
}

const maxAnalyticsMonths = 36

// monthRange returns [first day of (months-1) months ago, first day of next month)
// in the household's timezone, suitable as inclusive/exclusive bounds for
// analytics queries that group by month. The household timezone string is
// returned alongside so the SQL can pass it to date_trunc AT TIME ZONE.
func (s *AnalyticsService) monthRange(ctx context.Context, householdID models.ID, months int) (tz string, from, to time.Time, err error) {
	if months <= 0 || months > maxAnalyticsMonths {
		return "", time.Time{}, time.Time{}, ErrInvalidInput
	}
	h, err := s.households.Get(ctx, householdID)
	if err != nil {
		return "", time.Time{}, time.Time{}, err
	}
	loc, err := time.LoadLocation(h.Timezone)
	if err != nil {
		loc = time.UTC
	}
	now := time.Now().In(loc)
	to = time.Date(now.Year(), now.Month()+1, 1, 0, 0, 0, 0, loc)
	from = time.Date(now.Year(), now.Month()-time.Month(months-1), 1, 0, 0, 0, 0, loc)
	return h.Timezone, from, to, nil
}
