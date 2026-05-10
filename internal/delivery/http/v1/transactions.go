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
		CategoryID:     (*models.ID)(req.CategoryID),
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
	in := service.ListTransactionsInput{HouseholdID: hid}

	if v := c.Query("from"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			middleware.Respond(c, service.ErrInvalidInput)
			return
		}
		in.From = &t
	}
	if v := c.Query("to"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			middleware.Respond(c, service.ErrInvalidInput)
			return
		}
		in.To = &t
	}
	if v := c.Query("category_id"); v != "" {
		id, err := uuid.Parse(v)
		if err != nil {
			middleware.Respond(c, service.ErrInvalidInput)
			return
		}
		in.CategoryID = &id
	}
	if v := c.Query("account_id"); v != "" {
		id, err := uuid.Parse(v)
		if err != nil {
			middleware.Respond(c, service.ErrInvalidInput)
			return
		}
		in.AccountID = &id
	}
	if v := c.Query("type"); v != "" {
		t := models.TransactionType(v)
		in.Type = &t
	}
	if c.Query("uncategorized") == "true" {
		in.UncategorizedOnly = true
	}
	in.Search = strings.TrimSpace(c.Query("q"))
	if v := c.Query("amount_min"); v != "" {
		d, err := decimal.NewFromString(v)
		if err != nil {
			middleware.Respond(c, service.ErrInvalidInput)
			return
		}
		in.AmountMin = &d
	}
	if v := c.Query("amount_max"); v != "" {
		d, err := decimal.NewFromString(v)
		if err != nil {
			middleware.Respond(c, service.ErrInvalidInput)
			return
		}
		in.AmountMax = &d
	}
	if v := c.Query("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			middleware.Respond(c, service.ErrInvalidInput)
			return
		}
		in.Limit = n
	}
	if v := c.Query("cursor_id"); v != "" {
		id, err := uuid.Parse(v)
		if err != nil {
			middleware.Respond(c, service.ErrInvalidInput)
			return
		}
		in.CursorID = &id
	}
	if v := c.Query("cursor_at"); v != "" {
		t, err := time.Parse(time.RFC3339, v)
		if err != nil {
			middleware.Respond(c, service.ErrInvalidInput)
			return
		}
		in.CursorOccurredAt = &t
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

func (r *Router) getTransaction(c *gin.Context) {
	hid := middleware.MustHouseholdID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}
	t, err := r.svc.Transactions.Get(c.Request.Context(), hid, id)
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
		CategoryID:  (*models.ID)(req.CategoryID),
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
