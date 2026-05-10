package service

import (
	"context"
	"errors"
	"strings"

	"github.com/qazevent/hz_zachem/internal/models"
	"github.com/qazevent/hz_zachem/internal/repo"
)

type CategoryService struct {
	repo *repo.Repository
}

type CreateCategoryInput struct {
	HouseholdID models.ID
	ParentID    *models.ID
	Name        string
	Icon        string
	Color       string
	CreatedBy   models.ID
}

type UpdateCategoryInput struct {
	HouseholdID models.ID
	ID          models.ID
	ParentID    *models.ID
	Name        string
	Icon        string
	Color       string
}

func (s *CategoryService) Create(ctx context.Context, in CreateCategoryInput) (*models.Category, error) {
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" {
		return nil, ErrInvalidInput
	}
	c := &models.Category{
		HouseholdID: in.HouseholdID,
		ParentID:    in.ParentID,
		Name:        in.Name,
		Icon:        in.Icon,
		Color:       in.Color,
		CreatedBy:   in.CreatedBy,
	}
	if err := s.repo.Categories.Create(ctx, c); err != nil {
		if errors.Is(err, repo.ErrConflict) {
			return nil, ErrConflict
		}
		return nil, err
	}
	return c, nil
}

func (s *CategoryService) Get(ctx context.Context, householdID, id models.ID) (*models.Category, error) {
	c, err := s.repo.Categories.GetByID(ctx, householdID, id)
	if err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return c, nil
}

func (s *CategoryService) List(ctx context.Context, householdID models.ID) ([]models.Category, error) {
	return s.repo.Categories.List(ctx, householdID)
}

func (s *CategoryService) Update(ctx context.Context, in UpdateCategoryInput) (*models.Category, error) {
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" {
		return nil, ErrInvalidInput
	}
	if in.ParentID != nil && *in.ParentID == in.ID {
		return nil, ErrInvalidInput
	}
	c := &models.Category{
		ID:          in.ID,
		HouseholdID: in.HouseholdID,
		ParentID:    in.ParentID,
		Name:        in.Name,
		Icon:        in.Icon,
		Color:       in.Color,
	}
	if err := s.repo.Categories.Update(ctx, c); err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return s.Get(ctx, in.HouseholdID, in.ID)
}

func (s *CategoryService) SoftDelete(ctx context.Context, householdID, id, deletedBy models.ID) error {
	if err := s.repo.Categories.SoftDelete(ctx, householdID, id, deletedBy); err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return ErrNotFound
		}
		return err
	}
	return nil
}
