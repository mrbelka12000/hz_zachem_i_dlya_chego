package service

import (
	"github.com/mrbelka12000/hz_zachem/internal/config"
	"github.com/mrbelka12000/hz_zachem/internal/integrations/telegram"
	"github.com/mrbelka12000/hz_zachem/internal/repo"
)

type Service struct {
	repo   *repo.Repository
	tokens *tokenIssuer
	cfg    config.AuthConfig

	Auth         *AuthService
	Households   *HouseholdService
	Accounts     *AccountService
	Categories   *CategoryService
	Transactions *TransactionService
	Analytics    *AnalyticsService
	Imports      *ImportService
	Rules        *RuleService
	Budgets      *BudgetService
}

func New(cfg config.AuthConfig, repository *repo.Repository, tg *telegram.Client) *Service {
	tokens := newTokenIssuer(cfg.JWTSecret, cfg.AccessTTL, cfg.RefreshTTL)

	households := &HouseholdService{repo: repository}
	auth := &AuthService{repo: repository, tokens: tokens, refreshTTL: cfg.RefreshTTL, households: households}
	accounts := &AccountService{repo: repository, households: households}
	categories := &CategoryService{repo: repository}
	rules := &RuleService{repo: repository}
	budgets := &BudgetService{repo: repository, households: households, telegram: tg}
	transactions := &TransactionService{repo: repository, households: households, accounts: accounts, rules: rules, budgets: budgets}
	analytics := &AnalyticsService{repo: repository, households: households}
	imports := &ImportService{repo: repository, accounts: accounts, transactions: transactions}

	return &Service{
		repo:         repository,
		tokens:       tokens,
		cfg:          cfg,
		Auth:         auth,
		Households:   households,
		Accounts:     accounts,
		Categories:   categories,
		Transactions: transactions,
		Analytics:    analytics,
		Imports:      imports,
		Rules:        rules,
		Budgets:      budgets,
	}
}

func (s *Service) AuthConfig() config.AuthConfig { return s.cfg }

func (s *Service) Tokens() *tokenIssuer { return s.tokens }
