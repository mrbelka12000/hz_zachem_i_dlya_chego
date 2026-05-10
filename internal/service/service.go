package service

import (
	"github.com/qazevent/hz_zachem/internal/repo"
)

type Service struct {
	repo *repo.Repository
}

func New(repo *repo.Repository) *Service {
	return &Service{repo: repo}
}
