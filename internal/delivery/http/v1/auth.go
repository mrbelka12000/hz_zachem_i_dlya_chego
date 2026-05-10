package v1

import (
	"github.com/gin-gonic/gin"

	"github.com/mrbelka12000/hz_zachem/internal/delivery/http/middleware"
	"github.com/mrbelka12000/hz_zachem/internal/service"
)

type registerRequest struct {
	Email         string `json:"email" binding:"required,email"`
	Password      string `json:"password" binding:"required,min=8,max=256"`
	HouseholdName string `json:"household_name"`
}

type loginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type authResponse struct {
	UserID      string `json:"user_id"`
	HouseholdID string `json:"household_id"`
}

func (r *Router) register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}
	res, err := r.svc.Auth.Register(c.Request.Context(), service.RegisterInput{
		Email:         req.Email,
		Password:      req.Password,
		HouseholdName: req.HouseholdName,
	})
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	setAuthCookies(c, r.svc.AuthConfig(), res.AccessToken, res.AccessExpires, res.RefreshToken, res.RefreshExpires)
	created(c, authResponse{UserID: res.UserID.String(), HouseholdID: res.HouseholdID.String()})
}

func (r *Router) login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		middleware.Respond(c, service.ErrInvalidInput)
		return
	}
	res, err := r.svc.Auth.Login(c.Request.Context(), req.Email, req.Password)
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	setAuthCookies(c, r.svc.AuthConfig(), res.AccessToken, res.AccessExpires, res.RefreshToken, res.RefreshExpires)
	ok(c, authResponse{UserID: res.UserID.String(), HouseholdID: res.HouseholdID.String()})
}

func (r *Router) refresh(c *gin.Context) {
	cookie, _ := c.Cookie(r.svc.AuthConfig().CookieName + "_refresh")
	if cookie == "" {
		middleware.Respond(c, service.ErrUnauthorized)
		return
	}
	res, err := r.svc.Auth.Refresh(c.Request.Context(), cookie)
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	setAuthCookies(c, r.svc.AuthConfig(), res.AccessToken, res.AccessExpires, res.RefreshToken, res.RefreshExpires)
	ok(c, authResponse{UserID: res.UserID.String(), HouseholdID: res.HouseholdID.String()})
}

func (r *Router) logout(c *gin.Context) {
	cookie, _ := c.Cookie(r.svc.AuthConfig().CookieName + "_refresh")
	if err := r.svc.Auth.Logout(c.Request.Context(), cookie); err != nil {
		middleware.Respond(c, err)
		return
	}
	clearAuthCookies(c, r.svc.AuthConfig())
	noContent(c)
}

type meResponse struct {
	UserID       string   `json:"user_id"`
	HouseholdIDs []string `json:"household_ids"`
}

func (r *Router) me(c *gin.Context) {
	uid := middleware.MustUserID(c)
	households, err := r.svc.Households.ListMine(c.Request.Context(), uid)
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	ids := make([]string, 0, len(households))
	for _, h := range households {
		ids = append(ids, h.ID.String())
	}
	ok(c, meResponse{UserID: uid.String(), HouseholdIDs: ids})
}
