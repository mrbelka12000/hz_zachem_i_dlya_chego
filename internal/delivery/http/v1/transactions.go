package v1

import (
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"

	"github.com/mrbelka12000/hz_zachem/internal/delivery/http/middleware"
	"github.com/mrbelka12000/hz_zachem/internal/models"
	"github.com/mrbelka12000/hz_zachem/internal/service"
)

type createTransactionRequest struct {
	AccountID   uuid.UUID       `json:"account_id" binding:"required"`
	Type        string          `json:"type" binding:"required"`
	Amount      decimal.Decimal `json:"amount" binding:"required"`
	OccurredAt  time.Time       `json:"occurred_at"`
	Description string          `json:"description"`
	Merchant    string          `json:"merchant"`
	CategoryID  *uuid.UUID      `json:"category_id"`
}

type updateTransactionRequest struct {
	OccurredAt  time.Time       `json:"occurred_at"`
	Amount      decimal.Decimal `json:"amount" binding:"required"`
	Description string          `json:"description"`
	Merchant    string          `json:"merchant"`
	CategoryID  *uuid.UUID      `json:"category_id"`
}

type createTransferRequest struct {
	FromAccountID uuid.UUID       `json:"from_account_id" binding:"required"`
	ToAccountID   uuid.UUID       `json:"to_account_id" binding:"required"`
	Amount        decimal.Decimal `json:"amount" binding:"required"`
	OccurredAt    time.Time       `json:"occurred_at"`
	Description   string          `json:"description"`
}

type listTransactionsResponse struct {
	Transactions []models.Transaction `json:"transactions"`
	NextCursor   *cursor              `json:"next_cursor,omitempty"`
}

type cursor struct {
	ID         uuid.UUID `json:"id"`
	OccurredAt time.Time `json:"occurred_at"`
}

func (r *Router) createTransaction(c *gin.Context) {
	var req createTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}
	hid := middleware.MustHouseholdID(c)
	uid := middleware.MustUserID(c)
	t, err := r.svc.Transactions.Create(c.Request.Context(), service.CreateTransactionInput{
		HouseholdID:    hid,
		AccountID:      req.AccountID,
		Type:           models.TransactionType(req.Type),
		Amount:         req.Amount,
		OccurredAt:     req.OccurredAt,
		Description:    req.Description,
		Merchant:       req.Merchant,
		CategoryID:     req.CategoryID,
		IdempotencyKey: c.GetHeader("Idempotency-Key"),
		CreatedBy:      uid,
	})
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	created(c, t)
}

func (r *Router) createTransfer(c *gin.Context) {
	var req createTransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}
	hid := middleware.MustHouseholdID(c)
	uid := middleware.MustUserID(c)
	expense, income, err := r.svc.Transactions.CreateTransfer(c.Request.Context(), service.CreateTransferInput{
		HouseholdID:    hid,
		FromAccountID:  req.FromAccountID,
		ToAccountID:    req.ToAccountID,
		Amount:         req.Amount,
		OccurredAt:     req.OccurredAt,
		Description:    req.Description,
		IdempotencyKey: c.GetHeader("Idempotency-Key"),
		CreatedBy:      uid,
	})
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	created(c, gin.H{"expense": expense, "income": income})
}

func (r *Router) listTransactions(c *gin.Context) {
	hid := middleware.MustHouseholdID(c)
	in, err := buildListTransactionsInput(c, hid)
	if err != nil {
		middleware.Respond(c, err)
		return
	}

	transactions, err := r.svc.Transactions.List(c.Request.Context(), in)
	if err != nil {
		middleware.Respond(c, err)
		return
	}

	resp := listTransactionsResponse{Transactions: transactions}
	if len(transactions) > 0 && (in.Limit == 0 || len(transactions) == in.Limit) {
		last := transactions[len(transactions)-1]
		resp.NextCursor = &cursor{ID: last.ID, OccurredAt: last.OccurredAt}
	}
	ok(c, resp)
}

// buildListTransactionsInput parses the GET /transactions query string
// into the service input. Returns service.ErrInvalidInput on any badly
// formatted value so the handler can map it via middleware.Respond.
func buildListTransactionsInput(c *gin.Context, hid models.ID) (service.ListTransactionsInput, error) {
	in := service.ListTransactionsInput{HouseholdID: hid}
	var err error

	if in.From, err = queryTime(c, "from"); err != nil {
		return in, err
	}
	if in.To, err = queryTime(c, "to"); err != nil {
		return in, err
	}
	if in.CategoryID, err = queryUUID(c, "category_id"); err != nil {
		return in, err
	}
	if in.AccountID, err = queryUUID(c, "account_id"); err != nil {
		return in, err
	}
	if v := c.Query("type"); v != "" {
		t := models.TransactionType(v)
		in.Type = &t
	}
	in.UncategorizedOnly = c.Query("uncategorized") == "true"
	in.Search = strings.TrimSpace(c.Query("q"))
	if in.AmountMin, err = queryDecimal(c, "amount_min"); err != nil {
		return in, err
	}
	if in.AmountMax, err = queryDecimal(c, "amount_max"); err != nil {
		return in, err
	}
	if in.Limit, err = queryPositiveInt(c, "limit"); err != nil {
		return in, err
	}
	if in.CursorID, err = queryUUID(c, "cursor_id"); err != nil {
		return in, err
	}
	if in.CursorOccurredAt, err = queryTime(c, "cursor_at"); err != nil {
		return in, err
	}
	return in, nil
}

func queryTime(c *gin.Context, key string) (*time.Time, error) {
	v := c.Query(key)
	if v == "" {
		return nil, nil //nolint:nilnil // optional query param
	}
	t, err := time.Parse(time.RFC3339, v)
	if err != nil {
		return nil, service.ErrInvalidInput
	}
	return &t, nil
}

func queryUUID(c *gin.Context, key string) (*models.ID, error) {
	v := c.Query(key)
	if v == "" {
		return nil, nil //nolint:nilnil // optional query param
	}
	id, err := uuid.Parse(v)
	if err != nil {
		return nil, service.ErrInvalidInput
	}
	return &id, nil
}

func queryDecimal(c *gin.Context, key string) (*decimal.Decimal, error) {
	v := c.Query(key)
	if v == "" {
		return nil, nil //nolint:nilnil // optional query param
	}
	d, err := decimal.NewFromString(v)
	if err != nil {
		return nil, service.ErrInvalidInput
	}
	return &d, nil
}

func queryPositiveInt(c *gin.Context, key string) (int, error) {
	v := c.Query(key)
	if v == "" {
		return 0, nil
	}
	n, err := strconv.Atoi(v)
	if err != nil || n <= 0 {
		return 0, service.ErrInvalidInput
	}
	return n, nil
}

func (r *Router) getTransaction(c *gin.Context) {
	hid := middleware.MustHouseholdID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}
	t, err := r.svc.Transactions.GetWithCounterpart(c.Request.Context(), hid, id)
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	ok(c, t)
}

func (r *Router) updateTransaction(c *gin.Context) {
	var req updateTransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}
	hid := middleware.MustHouseholdID(c)
	uid := middleware.MustUserID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}
	t, err := r.svc.Transactions.Update(c.Request.Context(), service.UpdateTransactionInput{
		HouseholdID: hid,
		ID:          id,
		OccurredAt:  req.OccurredAt,
		Amount:      req.Amount,
		Description: req.Description,
		Merchant:    req.Merchant,
		CategoryID:  req.CategoryID,
		UpdatedBy:   uid,
	})
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	ok(c, t)
}

func (r *Router) pairTransfers(c *gin.Context) {
	hid := middleware.MustHouseholdID(c)
	paired, err := r.svc.Transactions.PairTransfers(c.Request.Context(), hid)
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	ok(c, gin.H{"paired": paired})
}

func (r *Router) unpairTransfer(c *gin.Context) {
	hid := middleware.MustHouseholdID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}
	unpaired, err := r.svc.Transactions.Unpair(c.Request.Context(), hid, id)
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	ok(c, gin.H{"unpaired": unpaired})
}

func (r *Router) deleteTransaction(c *gin.Context) {
	hid := middleware.MustHouseholdID(c)
	uid := middleware.MustUserID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}
	if err := r.svc.Transactions.SoftDelete(c.Request.Context(), hid, id, uid); err != nil {
		middleware.Respond(c, err)
		return
	}
	noContent(c)
}
