package service

import (
	"context"
	"errors"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/mrbelka12000/hz_zachem/internal/models"
	"github.com/mrbelka12000/hz_zachem/internal/repo"
)

const (
	bcryptCost     = 12
	minPasswordLen = 8
	maxPasswordLen = 256
	defaultHHName  = "My household"
)

type AuthService struct {
	repo       *repo.Repository
	tokens     *tokenIssuer
	refreshTTL time.Duration
	households *HouseholdService
}

type RegisterInput struct {
	Email         string
	Password      string
	HouseholdName string
}

type AuthResult struct {
	UserID         models.ID
	HouseholdID    models.ID
	AccessToken    string
	AccessExpires  time.Time
	RefreshToken   string
	RefreshExpires time.Time
}

func (s *AuthService) Register(ctx context.Context, in RegisterInput) (*AuthResult, error) {
	email := strings.TrimSpace(strings.ToLower(in.Email))
	if email == "" || len(in.Password) < minPasswordLen || len(in.Password) > maxPasswordLen {
		return nil, ErrInvalidInput
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcryptCost)
	if err != nil {
		return nil, err
	}

	user := &models.User{
		Email:        email,
		PasswordHash: string(hash),
	}
	if err := s.repo.Users.Create(ctx, user); err != nil {
		if errors.Is(err, repo.ErrConflict) {
			return nil, ErrConflict
		}
		return nil, err
	}

	hhName := strings.TrimSpace(in.HouseholdName)
	if hhName == "" {
		hhName = defaultHHName
	}
	hh := &models.Household{Name: hhName}
	if err := s.repo.Households.CreateWithOwner(ctx, hh, user.ID); err != nil {
		return nil, err
	}

	return s.issueAuthResult(ctx, user.ID, hh.ID, time.Now())
}

func (s *AuthService) Login(ctx context.Context, email, password string) (*AuthResult, error) {
	email = strings.TrimSpace(strings.ToLower(email))
	user, err := s.repo.Users.GetByEmail(ctx, email)
	if err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	householdID, err := s.repo.Households.PrimaryHouseholdID(ctx, user.ID)
	if err != nil {
		return nil, err
	}
	return s.issueAuthResult(ctx, user.ID, householdID, time.Now())
}

func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (*AuthResult, error) {
	hash := hashRefreshToken(refreshToken)
	stored, err := s.repo.Users.FindActiveRefreshToken(ctx, hash)
	if err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return nil, ErrTokenExpired
		}
		return nil, err
	}
	if err := s.repo.Users.RevokeRefreshToken(ctx, stored.ID); err != nil {
		return nil, err
	}
	householdID, err := s.repo.Households.PrimaryHouseholdID(ctx, stored.UserID)
	if err != nil {
		return nil, err
	}
	return s.issueAuthResult(ctx, stored.UserID, householdID, time.Now())
}

func (s *AuthService) Logout(ctx context.Context, refreshToken string) error {
	if refreshToken == "" {
		return nil
	}
	hash := hashRefreshToken(refreshToken)
	stored, err := s.repo.Users.FindActiveRefreshToken(ctx, hash)
	if err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return nil
		}
		return err
	}
	return s.repo.Users.RevokeRefreshToken(ctx, stored.ID)
}

// SetTelegramChatID updates the user's Telegram chat ID (the integer
// the bot uses to send DMs). Pass nil to unlink. Used by the Settings
// page so the budget notifier knows where to deliver alerts.
func (s *AuthService) SetTelegramChatID(ctx context.Context, userID models.ID, chatID *int64) error {
	if err := s.repo.Users.UpdateTelegramUserID(ctx, userID, chatID); err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return ErrNotFound
		}
		return err
	}
	return nil
}

// Me returns the user's identity blob (id + telegram link state) for
// the Settings page.
func (s *AuthService) Me(ctx context.Context, userID models.ID) (*models.User, error) {
	u, err := s.repo.Users.GetByID(ctx, userID)
	if err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return u, nil
}

func (s *AuthService) ParseAccess(token string) (*AccessClaims, error) {
	return s.tokens.parseAccess(token)
}

func (s *AuthService) issueAuthResult(ctx context.Context, userID, householdID models.ID, now time.Time) (*AuthResult, error) {
	access, accessExp, err := s.tokens.issueAccess(userID, now)
	if err != nil {
		return nil, err
	}
	refresh, err := generateRefreshToken()
	if err != nil {
		return nil, err
	}
	refreshExp := now.Add(s.refreshTTL)
	stored := &models.RefreshToken{
		UserID:    userID,
		TokenHash: hashRefreshToken(refresh),
		ExpiresAt: refreshExp,
	}
	if err := s.repo.Users.StoreRefreshToken(ctx, stored); err != nil {
		return nil, err
	}
	return &AuthResult{
		UserID:         userID,
		HouseholdID:    householdID,
		AccessToken:    access,
		AccessExpires:  accessExp,
		RefreshToken:   refresh,
		RefreshExpires: refreshExp,
	}, nil
}
