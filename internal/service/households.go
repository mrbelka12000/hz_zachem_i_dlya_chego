package service

import (
	"context"
	"errors"

	"github.com/qazevent/hz_zachem/internal/models"
	"github.com/qazevent/hz_zachem/internal/repo"
)

type HouseholdService struct {
	repo *repo.Repository
}

func (s *HouseholdService) Get(ctx context.Context, householdID models.ID) (*models.Household, error) {
	h, err := s.repo.Households.GetByID(ctx, householdID)
	if err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return h, nil
}

func (s *HouseholdService) RequireMembership(ctx context.Context, userID, householdID models.ID) (*models.HouseholdMember, error) {
	m, err := s.repo.Households.GetMembership(ctx, userID, householdID)
	if err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return nil, ErrForbidden
		}
		return nil, err
	}
	return m, nil
}

func (s *HouseholdService) ListMine(ctx context.Context, userID models.ID) ([]models.Household, error) {
	return s.repo.Households.ListUserHouseholds(ctx, userID)
}

func (s *HouseholdService) PrimaryID(ctx context.Context, userID models.ID) (models.ID, error) {
	id, err := s.repo.Households.PrimaryHouseholdID(ctx, userID)
	if err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return models.ID{}, ErrNotFound
		}
		return models.ID{}, err
	}
	return id, nil
}
