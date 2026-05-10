package service

import (
	"context"
	"errors"
	"io"

	"github.com/mrbelka12000/hz_zachem/internal/integrations/csv"
	"github.com/mrbelka12000/hz_zachem/internal/models"
	"github.com/mrbelka12000/hz_zachem/internal/repo"
)

type ImportService struct {
	repo     *repo.Repository
	accounts *AccountService
}

type ImportCSVInput struct {
	HouseholdID models.ID
	AccountID   models.ID
	CreatedBy   models.ID
	Reader      io.Reader
}

type ImportSummary struct {
	Total      int            `json:"total"`
	Inserted   int            `json:"inserted"`
	Duplicates int            `json:"duplicates"`
	Errors     []csv.RowError `json:"errors,omitempty"`
}

func (s *ImportService) ImportCSV(ctx context.Context, in ImportCSVInput) (*ImportSummary, error) {
	account, err := s.accounts.Get(ctx, in.HouseholdID, in.AccountID)
	if err != nil {
		return nil, err
	}

	rows, rowErrs, err := csv.Parse(in.Reader)
	if err != nil {
		return nil, errors.Join(ErrInvalidInput, err)
	}

	summary := &ImportSummary{
		Total:  len(rows) + len(rowErrs),
		Errors: rowErrs,
	}

	for _, row := range rows {
		hash := row.ExternalHash
		if existing, err := s.repo.Transactions.FindByExternalHash(ctx, in.HouseholdID, account.ID, hash); err == nil && existing != nil {
			summary.Duplicates++
			continue
		} else if err != nil && !errors.Is(err, repo.ErrNotFound) {
			return nil, err
		}

		t := &models.Transaction{
			HouseholdID:    in.HouseholdID,
			AccountID:      account.ID,
			Type:           row.Type,
			Amount:         row.Amount,
			Currency:       account.Currency,
			OccurredAt:     row.OccurredAt,
			Description:    row.Description,
			Merchant:       row.Merchant,
			CategorySource: models.CategorySourceNone,
			Source:         models.TransactionSourceCSV,
			ExternalHash:   strPtr(hash),
			RawPayload:     row.RawPayload,
			CreatedBy:      in.CreatedBy,
		}
		if err := s.repo.Transactions.Create(ctx, t); err != nil {
			if errors.Is(err, repo.ErrConflict) {
				summary.Duplicates++
				continue
			}
			return nil, err
		}
		summary.Inserted++
	}

	return summary, nil
}

func strPtr(s string) *string { return &s }
