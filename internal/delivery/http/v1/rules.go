package v1

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/mrbelka12000/hz_zachem/internal/delivery/http/middleware"
	"github.com/mrbelka12000/hz_zachem/internal/service"
)

type ruleRequest struct {
	Name          string    `json:"name"`
	MatchPatterns []string  `json:"match_patterns" binding:"required,min=1,dive,min=1,max=200"`
	CategoryID    uuid.UUID `json:"category_id" binding:"required"`
	Priority      int       `json:"priority"`
	Enabled       *bool     `json:"enabled"`
}

func (r ruleRequest) enabledValue() bool {
	if r.Enabled == nil {
		return true
	}
	return *r.Enabled
}

func (r *Router) listRules(c *gin.Context) {
	hid := middleware.MustHouseholdID(c)
	rules, err := r.svc.Rules.List(c.Request.Context(), hid)
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	ok(c, gin.H{"rules": rules})
}

func (r *Router) createRule(c *gin.Context) {
	var req ruleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}
	hid := middleware.MustHouseholdID(c)
	uid := middleware.MustUserID(c)
	rule, err := r.svc.Rules.Create(c.Request.Context(), service.CreateRuleInput{
		HouseholdID:   hid,
		Name:          req.Name,
		MatchPatterns: req.MatchPatterns,
		CategoryID:    req.CategoryID,
		Priority:      req.Priority,
		Enabled:       req.enabledValue(),
		CreatedBy:     uid,
	})
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	created(c, rule)
}

func (r *Router) getRule(c *gin.Context) {
	hid := middleware.MustHouseholdID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}
	rule, err := r.svc.Rules.Get(c.Request.Context(), hid, id)
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	ok(c, rule)
}

func (r *Router) updateRule(c *gin.Context) {
	var req ruleRequest
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
	rule, err := r.svc.Rules.Update(c.Request.Context(), service.UpdateRuleInput{
		HouseholdID:   hid,
		ID:            id,
		Name:          req.Name,
		MatchPatterns: req.MatchPatterns,
		CategoryID:    req.CategoryID,
		Priority:      req.Priority,
		Enabled:       req.enabledValue(),
	})
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	ok(c, rule)
}

func (r *Router) deleteRule(c *gin.Context) {
	hid := middleware.MustHouseholdID(c)
	uid := middleware.MustUserID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}
	if err := r.svc.Rules.SoftDelete(c.Request.Context(), hid, id, uid); err != nil {
		middleware.Respond(c, err)
		return
	}
	noContent(c)
}

func (r *Router) applyRules(c *gin.Context) {
	hid := middleware.MustHouseholdID(c)
	updated, err := r.svc.Rules.ApplyToUncategorized(c.Request.Context(), hid)
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	ok(c, gin.H{"updated": updated})
}
