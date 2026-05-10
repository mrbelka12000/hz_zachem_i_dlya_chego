package v1

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/mrbelka12000/hz_zachem/internal/delivery/http/middleware"
	"github.com/mrbelka12000/hz_zachem/internal/service"
)

type categoryRequest struct {
	Name     string     `json:"name" binding:"required,min=1,max=100"`
	ParentID *uuid.UUID `json:"parent_id"`
	Icon     string     `json:"icon"`
	Color    string     `json:"color"`
}

func (r *Router) listCategories(c *gin.Context) {
	hid := middleware.MustHouseholdID(c)
	categories, err := r.svc.Categories.List(c.Request.Context(), hid)
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	ok(c, gin.H{"categories": categories})
}

func (r *Router) createCategory(c *gin.Context) {
	var req categoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}
	hid := middleware.MustHouseholdID(c)
	uid := middleware.MustUserID(c)
	cat, err := r.svc.Categories.Create(c.Request.Context(), service.CreateCategoryInput{
		HouseholdID: hid,
		ParentID:    req.ParentID,
		Name:        req.Name,
		Icon:        req.Icon,
		Color:       req.Color,
		CreatedBy:   uid,
	})
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	created(c, cat)
}

func (r *Router) getCategory(c *gin.Context) {
	hid := middleware.MustHouseholdID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}
	cat, err := r.svc.Categories.Get(c.Request.Context(), hid, id)
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	ok(c, cat)
}

func (r *Router) updateCategory(c *gin.Context) {
	var req categoryRequest
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
	cat, err := r.svc.Categories.Update(c.Request.Context(), service.UpdateCategoryInput{
		HouseholdID: hid,
		ID:          id,
		ParentID:    req.ParentID,
		Name:        req.Name,
		Icon:        req.Icon,
		Color:       req.Color,
	})
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	ok(c, cat)
}

func (r *Router) deleteCategory(c *gin.Context) {
	hid := middleware.MustHouseholdID(c)
	uid := middleware.MustUserID(c)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}
	if err := r.svc.Categories.SoftDelete(c.Request.Context(), hid, id, uid); err != nil {
		middleware.Respond(c, err)
		return
	}
	noContent(c)
}
