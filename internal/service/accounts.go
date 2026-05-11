package service

import (
	"context"
	"errors"
	"strings"

	"github.com/shopspring/decimal"

	"github.com/mrbelka12000/hz_zachem/internal/models"
	"github.com/mrbelka12000/hz_zachem/internal/repo"
)

type AccountService struct {
	repo       *repo.Repository
	households *HouseholdService
}

type CreateAccountInput struct {
	HouseholdID    models.ID
	Name           string
	Type           models.AccountType
	Currency       string
	InitialBalance models.Money
	CreatedBy      models.ID
}

type UpdateAccountInput struct {
	HouseholdID    models.ID
	ID             models.ID
	Name           string
	Type           models.AccountType
	Currency       string
	InitialBalance models.Money
}

func (s *AccountService) Create(ctx context.Context, in CreateAccountInput) (*models.Account, error) {
	in.Name = strings.TrimSpace(in.Name)
	in.Currency = strings.ToUpper(strings.TrimSpace(in.Currency))
	if in.Name == "" || !in.Type.Valid() || len(in.Currency) != 3 {
		return nil, ErrInvalidInput
	}
	if in.InitialBalance.LessThan(decimal.Zero) {
		return nil, ErrInvalidInput
	}

	if err := s.checkCurrency(ctx, in.HouseholdID, in.Currency); err != nil {
		return nil, err
	}

	a := &models.Account{
		HouseholdID:    in.HouseholdID,
		Name:           in.Name,
		Type:           in.Type,
		Currency:       in.Currency,
		InitialBalance: in.InitialBalance,
		Status:         models.AccountStatusActive,
		CreatedBy:      in.CreatedBy,
	}
	if err := s.repo.Accounts.Create(ctx, a); err != nil {
		if errors.Is(err, repo.ErrConflict) {
			return nil, ErrConflict
		}
		return nil, err
	}
	return a, nil
}

func (s *AccountService) Get(ctx context.Context, householdID, id models.ID) (*models.Account, error) {
	a, err := s.repo.Accounts.GetByID(ctx, householdID, id)
	if err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return a, nil
}

func (s *AccountService) List(ctx context.Context, householdID models.ID, includeArchived bool) ([]models.Account, error) {
	return s.repo.Accounts.List(ctx, householdID, includeArchived)
}

func (s *AccountService) Balances(ctx context.Context, householdID models.ID, includeArchived bool) ([]repo.AccountBalanceRow, error) {
	return s.repo.Accounts.Balances(ctx, householdID, includeArchived)
}

func (s *AccountService) Balance(ctx context.Context, householdID, id models.ID) (models.Money, error) {
	balance, err := s.repo.Accounts.Balance(ctx, householdID, id)
	if err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return models.Money{}, ErrNotFound
		}
		return models.Money{}, err
	}
	return balance, nil
}

func (s *AccountService) Update(ctx context.Context, in UpdateAccountInput) (*models.Account, error) {
	in.Name = strings.TrimSpace(in.Name)
	in.Currency = strings.ToUpper(strings.TrimSpace(in.Currency))
	if in.Name == "" || !in.Type.Valid() || len(in.Currency) != 3 {
		return nil, ErrInvalidInput
	}
	if err := s.checkCurrency(ctx, in.HouseholdID, in.Currency); err != nil {
		return nil, err
	}
	a := &models.Account{
		ID:             in.ID,
		HouseholdID:    in.HouseholdID,
		Name:           in.Name,
		Type:           in.Type,
		Currency:       in.Currency,
		InitialBalance: in.InitialBalance,
	}
	if err := s.repo.Accounts.Update(ctx, a); err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return s.Get(ctx, in.HouseholdID, in.ID)
}

func (s *AccountService) Archive(ctx context.Context, householdID, id models.ID) error {
	if err := s.repo.Accounts.SetStatus(ctx, householdID, id, models.AccountStatusArchived); err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return ErrNotFound
		}
		return err
	}
	return nil
}

func (s *AccountService) Unarchive(ctx context.Context, householdID, id models.ID) error {
	if err := s.repo.Accounts.SetStatus(ctx, householdID, id, models.AccountStatusActive); err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return ErrNotFound
		}
		return err
	}
	return nil
}

func (s *AccountService) SoftDelete(ctx context.Context, householdID, id, deletedBy models.ID) error {
	if err := s.repo.Accounts.SoftDelete(ctx, householdID, id, deletedBy); err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return ErrNotFound
		}
		return err
	}
	return nil
}

// supportedCurrencies enumerates currencies the app accepts on accounts.
// KZT is the base; USD and EUR are convertible at display time on the
// client via the public jsdelivr currency API.
var supportedCurrencies = map[string]struct{}{
	"KZT": {},
	"USD": {},
	"EUR": {},
}

func (s *AccountService) checkCurrency(_ context.Context, _ models.ID, currency string) error {
	if _, ok := supportedCurrencies[strings.ToUpper(currency)]; !ok {
		return ErrCurrencyMismatch
	}
	return nil
}
