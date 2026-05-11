package v1

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/shopspring/decimal"

	"github.com/mrbelka12000/hz_zachem/internal/delivery/http/middleware"
	"github.com/mrbelka12000/hz_zachem/internal/models"
	"github.com/mrbelka12000/hz_zachem/internal/service"
)

type accountRequest struct {
	Name           string          `json:"name" binding:"required,min=1,max=100"`
	Type           string          `json:"type" binding:"required"`
	Currency       string          `json:"currency" binding:"required,len=3"`
	InitialBalance decimal.Decimal `json:"initial_balance"`
}

func (r *Router) listAccounts(c *gin.Context) {
	hid := middleware.MustHouseholdID(c)
	includeArchived := queryBool(c, "archived")
	accounts, err := r.svc.Accounts.List(c.Request.Context(), hid, includeArchived)
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	ok(c, gin.H{"accounts": accounts})
}

func (r *Router) createAccount(c *gin.Context) {
	var req accountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}
	hid := middleware.MustHouseholdID(c)
	uid := middleware.MustUserID(c)
	a, err := r.svc.Accounts.Create(c.Request.Context(), service.CreateAccountInput{
		HouseholdID:    hid,
		Name:           req.Name,
		Type:           models.AccountType(req.Type),
		Currency:       req.Currency,
		InitialBalance: req.InitialBalance,
		CreatedBy:      uid,
	})
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	created(c, a)
}

func (r *Router) getAccount(c *gin.Context) {
	hid := middleware.MustHouseholdID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}
	a, err := r.svc.Accounts.Get(c.Request.Context(), hid, id)
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	ok(c, a)
}

func (r *Router) updateAccount(c *gin.Context) {
	var req accountRequest
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
	a, err := r.svc.Accounts.Update(c.Request.Context(), service.UpdateAccountInput{
		HouseholdID:    hid,
		ID:             id,
		Name:           req.Name,
		Type:           models.AccountType(req.Type),
		Currency:       req.Currency,
		InitialBalance: req.InitialBalance,
	})
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	ok(c, a)
}

func (r *Router) listAccountBalances(c *gin.Context) {
	hid := middleware.MustHouseholdID(c)
	includeArchived := queryBool(c, "archived")
	rows, err := r.svc.Accounts.Balances(c.Request.Context(), hid, includeArchived)
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	okRows(c, rows)
}

func (r *Router) getAccountBalance(c *gin.Context) {
	hid := middleware.MustHouseholdID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}
	a, err := r.svc.Accounts.Get(c.Request.Context(), hid, id)
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	balance, err := r.svc.Accounts.Balance(c.Request.Context(), hid, id)
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	ok(c, gin.H{"balance": balance, "currency": a.Currency})
}

func (r *Router) archiveAccount(c *gin.Context) {
	hid := middleware.MustHouseholdID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}
	if err := r.svc.Accounts.Archive(c.Request.Context(), hid, id); err != nil {
		middleware.Respond(c, err)
		return
	}
	noContent(c)
}

func (r *Router) unarchiveAccount(c *gin.Context) {
	hid := middleware.MustHouseholdID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}
	if err := r.svc.Accounts.Unarchive(c.Request.Context(), hid, id); err != nil {
		middleware.Respond(c, err)
		return
	}
	noContent(c)
}

func (r *Router) deleteAccount(c *gin.Context) {
	hid := middleware.MustHouseholdID(c)
	uid := middleware.MustUserID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}
	if err := r.svc.Accounts.SoftDelete(c.Request.Context(), hid, id, uid); err != nil {
		middleware.Respond(c, err)
		return
	}
	noContent(c)
}
