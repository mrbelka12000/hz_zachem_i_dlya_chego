package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/shopspring/decimal"

	"github.com/mrbelka12000/hz_zachem/internal/integrations/telegram"
	"github.com/mrbelka12000/hz_zachem/internal/models"
	"github.com/mrbelka12000/hz_zachem/internal/repo"
)

// alertThresholds in ascending order. The evaluator fires every
// crossed threshold whose alert row doesn't yet exist for the period.
var alertThresholds = []int{50, 80, 100}

type BudgetService struct {
	repo       *repo.Repository
	households *HouseholdService
	telegram   *telegram.Client
}

type CreateBudgetInput struct {
	HouseholdID models.ID
	Name        string
	CategoryID  *models.ID
	Amount      models.Money
	Currency    string
	Enabled     bool
	CreatedBy   models.ID
}

type UpdateBudgetInput struct {
	HouseholdID models.ID
	ID          models.ID
	Name        string
	CategoryID  *models.ID
	Amount      models.Money
	Currency    string
	Enabled     bool
}

func (s *BudgetService) Create(ctx context.Context, in CreateBudgetInput) (*models.Budget, error) {
	currency, err := s.validateInput(in.Currency, in.Amount)
	if err != nil {
		return nil, err
	}
	if err := s.ensureCategory(ctx, in.HouseholdID, in.CategoryID); err != nil {
		return nil, err
	}

	b := &models.Budget{
		HouseholdID: in.HouseholdID,
		CategoryID:  in.CategoryID,
		Name:        strings.TrimSpace(in.Name),
		Amount:      in.Amount,
		Currency:    currency,
		Period:      models.BudgetPeriodMonthly,
		StartsOn:    startOfMonth(time.Now().UTC()),
		Enabled:     in.Enabled,
		CreatedBy:   in.CreatedBy,
	}
	if err := s.repo.Budgets.Create(ctx, b); err != nil {
		return nil, err
	}
	return b, nil
}

func (s *BudgetService) Update(ctx context.Context, in UpdateBudgetInput) (*models.Budget, error) {
	currency, err := s.validateInput(in.Currency, in.Amount)
	if err != nil {
		return nil, err
	}
	if err := s.ensureCategory(ctx, in.HouseholdID, in.CategoryID); err != nil {
		return nil, err
	}

	b := &models.Budget{
		ID:          in.ID,
		HouseholdID: in.HouseholdID,
		CategoryID:  in.CategoryID,
		Name:        strings.TrimSpace(in.Name),
		Amount:      in.Amount,
		Currency:    currency,
		Enabled:     in.Enabled,
	}
	if err := s.repo.Budgets.Update(ctx, b); err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return s.Get(ctx, in.HouseholdID, in.ID)
}

func (s *BudgetService) Get(ctx context.Context, householdID, id models.ID) (*models.Budget, error) {
	b, err := s.repo.Budgets.GetByID(ctx, householdID, id)
	if err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return b, nil
}

func (s *BudgetService) List(ctx context.Context, householdID models.ID) ([]models.Budget, error) {
	return s.repo.Budgets.List(ctx, householdID)
}

func (s *BudgetService) SoftDelete(ctx context.Context, householdID, id, deletedBy models.ID) error {
	if err := s.repo.Budgets.SoftDelete(ctx, householdID, id, deletedBy); err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return ErrNotFound
		}
		return err
	}
	return nil
}

// BudgetStatus snapshots one budget's current-period spending so the
// frontend can render progress bars without recomputing client-side.
type BudgetStatus struct {
	Budget     models.Budget `json:"budget"`
	Spent      models.Money  `json:"spent"`
	Remaining  models.Money  `json:"remaining"`
	PercentInt int           `json:"percent"` // floor of (spent / amount * 100)
	PeriodFrom time.Time     `json:"period_from"`
	PeriodTo   time.Time     `json:"period_to"`
}

// Status returns the current-period spend for every budget in the
// household. The frontend uses this to render progress bars.
func (s *BudgetService) Status(ctx context.Context, householdID models.ID) ([]BudgetStatus, error) {
	budgets, err := s.repo.Budgets.List(ctx, householdID)
	if err != nil {
		return nil, err
	}
	out := make([]BudgetStatus, 0, len(budgets))
	for i := range budgets {
		b := &budgets[i]
		if !b.Enabled {
			out = append(out, BudgetStatus{Budget: *b})
			continue
		}
		from, to := monthlyPeriod(time.Now().UTC())
		spent, err := s.repo.Budgets.PeriodSpend(ctx, b, from, to)
		if err != nil {
			return nil, err
		}
		out = append(out, BudgetStatus{
			Budget:     *b,
			Spent:      spent,
			Remaining:  b.Amount.Sub(spent),
			PercentInt: percentInt(spent, b.Amount),
			PeriodFrom: from,
			PeriodTo:   to,
		})
	}
	return out, nil
}

// OnTransactionCreated is called by TransactionService after a
// successful insert. Best-effort — errors are logged, not surfaced,
// so a notification failure never blocks the transaction insert.
func (s *BudgetService) OnTransactionCreated(ctx context.Context, t *models.Transaction) {
	if t == nil || t.Type != models.TransactionTypeExpense || t.TransferID != nil {
		return
	}
	budgets, err := s.repo.Budgets.ListEnabledForCategory(ctx, t.HouseholdID, t.CategoryID)
	if err != nil {
		log.Printf("budgets: list for transaction %s: %v", t.ID, err)
		return
	}
	for i := range budgets {
		s.evaluate(ctx, &budgets[i])
	}
}

func (s *BudgetService) evaluate(ctx context.Context, b *models.Budget) {
	if b.Currency == "" || b.Amount.Sign() <= 0 {
		return
	}
	from, _ := monthlyPeriod(time.Now().UTC())
	spent, err := s.repo.Budgets.PeriodSpend(ctx, b, from, addMonth(from))
	if err != nil {
		log.Printf("budgets: spend for %s: %v", b.ID, err)
		return
	}
	pct := percentInt(spent, b.Amount)
	for _, threshold := range alertThresholds {
		if pct < threshold {
			break
		}
		if _, err := s.repo.Budgets.FindAlert(ctx, b.ID, from, threshold); err == nil {
			continue // already fired
		} else if !errors.Is(err, repo.ErrNotFound) {
			log.Printf("budgets: alert lookup %s/%d: %v", b.ID, threshold, err)
			continue
		}
		alert := &models.BudgetAlert{
			BudgetID:     b.ID,
			PeriodStart:  from,
			ThresholdPct: threshold,
		}
		if err := s.repo.Budgets.InsertAlert(ctx, alert); err != nil {
			if errors.Is(err, repo.ErrConflict) {
				continue // race: someone else just fired this threshold
			}
			log.Printf("budgets: insert alert %s/%d: %v", b.ID, threshold, err)
			continue
		}
		s.deliver(ctx, b, alert, spent)
	}
}

func (s *BudgetService) deliver(ctx context.Context, b *models.Budget, alert *models.BudgetAlert, spent decimal.Decimal) {
	users, err := s.repo.Users.ListHouseholdMembersWithTelegram(ctx, b.HouseholdID)
	if err != nil {
		log.Printf("budgets: list telegram members for %s: %v", b.HouseholdID, err)
		return
	}
	if len(users) == 0 {
		log.Printf("budgets: alert %s fired but no household members linked Telegram", alert.ID)
		return
	}
	msg := formatAlertMessage(b, alert, spent)
	delivered := false
	for _, u := range users {
		if u.TelegramUserID == nil {
			continue
		}
		if err := s.telegram.SendMessage(ctx, *u.TelegramUserID, msg); err != nil {
			log.Printf("budgets: telegram send to user %s: %v", u.ID, err)
			continue
		}
		delivered = true
	}
	if delivered {
		if err := s.repo.Budgets.MarkDelivered(ctx, alert.ID); err != nil {
			log.Printf("budgets: mark delivered %s: %v", alert.ID, err)
		}
	}
}

func formatAlertMessage(b *models.Budget, alert *models.BudgetAlert, spent decimal.Decimal) string {
	label := b.Name
	if label == "" {
		if b.CategoryID == nil {
			label = "Overall budget"
		} else {
			label = "Category budget"
		}
	}
	period := alert.PeriodStart.Format("Jan 2006")
	return fmt.Sprintf(
		"⚠️ %s — %d%% reached for %s.\nSpent: %s %s · Cap: %s %s",
		label, alert.ThresholdPct, period,
		spent.StringFixed(2), b.Currency,
		b.Amount.StringFixed(2), b.Currency,
	)
}

func (s *BudgetService) validateInput(currency string, amount decimal.Decimal) (string, error) {
	currency = strings.ToUpper(strings.TrimSpace(currency))
	if len(currency) != 3 {
		return "", ErrInvalidInput
	}
	if amount.Sign() <= 0 {
		return "", ErrInvalidInput
	}
	return currency, nil
}

func (s *BudgetService) ensureCategory(ctx context.Context, householdID models.ID, categoryID *models.ID) error {
	if categoryID == nil {
		return nil
	}
	if *categoryID == (models.ID{}) {
		return ErrInvalidInput
	}
	if _, err := s.repo.Categories.GetByID(ctx, householdID, *categoryID); err != nil {
		if errors.Is(err, repo.ErrNotFound) {
			return ErrInvalidInput
		}
		return err
	}
	return nil
}

func startOfMonth(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, t.Location())
}

func addMonth(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month()+1, 1, 0, 0, 0, 0, t.Location())
}

func monthlyPeriod(now time.Time) (from, to time.Time) {
	from = startOfMonth(now)
	to = addMonth(from)
	return from, to
}

func percentInt(spent, amount decimal.Decimal) int {
	if amount.Sign() <= 0 {
		return 0
	}
	pct := spent.Mul(decimal.NewFromInt(100)).Div(amount).Floor()
	v := pct.IntPart()
	if v < 0 {
		return 0
	}
	const maxInt32 = 1<<31 - 1
	if v > maxInt32 {
		return maxInt32
	}
	return int(v)
}
