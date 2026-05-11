package v1

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"

	"github.com/mrbelka12000/hz_zachem/internal/delivery/http/middleware"
	"github.com/mrbelka12000/hz_zachem/internal/service"
)

type budgetRequest struct {
	Name       string          `json:"name"`
	CategoryID *uuid.UUID      `json:"category_id"`
	Amount     decimal.Decimal `json:"amount" binding:"required"`
	Currency   string          `json:"currency" binding:"required,len=3"`
	Enabled    *bool           `json:"enabled"`
}

func (r budgetRequest) enabledValue() bool {
	if r.Enabled == nil {
		return true
	}
	return *r.Enabled
}

func (r *Router) listBudgets(c *gin.Context) {
	hid := middleware.MustHouseholdID(c)
	rows, err := r.svc.Budgets.List(c.Request.Context(), hid)
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	ok(c, gin.H{"budgets": rows})
}

func (r *Router) listBudgetStatuses(c *gin.Context) {
	hid := middleware.MustHouseholdID(c)
	rows, err := r.svc.Budgets.Status(c.Request.Context(), hid)
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	okRows(c, rows)
}

func (r *Router) createBudget(c *gin.Context) {
	var req budgetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}
	hid := middleware.MustHouseholdID(c)
	uid := middleware.MustUserID(c)
	b, err := r.svc.Budgets.Create(c.Request.Context(), service.CreateBudgetInput{
		HouseholdID: hid,
		Name:        req.Name,
		CategoryID:  req.CategoryID,
		Amount:      req.Amount,
		Currency:    req.Currency,
		Enabled:     req.enabledValue(),
		CreatedBy:   uid,
	})
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	created(c, b)
}

func (r *Router) getBudget(c *gin.Context) {
	hid := middleware.MustHouseholdID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}
	b, err := r.svc.Budgets.Get(c.Request.Context(), hid, id)
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	ok(c, b)
}

func (r *Router) updateBudget(c *gin.Context) {
	var req budgetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}
	hid := middleware.MustHouseholdID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}
	b, err := r.svc.Budgets.Update(c.Request.Context(), service.UpdateBudgetInput{
		HouseholdID: hid,
		ID:          id,
		Name:        req.Name,
		CategoryID:  req.CategoryID,
		Amount:      req.Amount,
		Currency:    req.Currency,
		Enabled:     req.enabledValue(),
	})
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	ok(c, b)
}

func (r *Router) deleteBudget(c *gin.Context) {
	hid := middleware.MustHouseholdID(c)
	uid := middleware.MustUserID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}
	if err := r.svc.Budgets.SoftDelete(c.Request.Context(), hid, id, uid); err != nil {
		middleware.Respond(c, err)
		return
	}
	noContent(c)
}
