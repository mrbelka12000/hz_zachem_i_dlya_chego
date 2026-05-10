package service

import (
	"github.com/qazevent/<service_name>/internal/repo"
)

type Service struct {
	repo *repo.Repository
}

func New(repo *repo.Repository) *Service {
	return &Service{repo: repo}
}
