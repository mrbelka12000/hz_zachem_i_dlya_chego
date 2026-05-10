package v1

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/qazevent/hz_zachem/internal/config"
)

func ok(c *gin.Context, body any) {
	c.JSON(http.StatusOK, body)
}

func created(c *gin.Context, body any) {
	c.JSON(http.StatusCreated, body)
}

func noContent(c *gin.Context) {
	c.Status(http.StatusNoContent)
}

func setAuthCookies(c *gin.Context, cfg config.AuthConfig, accessToken string, accessExpires time.Time, refreshToken string, refreshExpires time.Time) {
	maxAgeAccess := int(time.Until(accessExpires).Seconds())
	if maxAgeAccess < 0 {
		maxAgeAccess = 0
	}
	maxAgeRefresh := int(time.Until(refreshExpires).Seconds())
	if maxAgeRefresh < 0 {
		maxAgeRefresh = 0
	}

	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(cfg.CookieName, accessToken, maxAgeAccess, "/", cfg.CookieDomain, cfg.SecureCookie, true)
	c.SetCookie(cfg.CookieName+"_refresh", refreshToken, maxAgeRefresh, "/v1/auth", cfg.CookieDomain, cfg.SecureCookie, true)
}

func clearAuthCookies(c *gin.Context, cfg config.AuthConfig) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(cfg.CookieName, "", -1, "/", cfg.CookieDomain, cfg.SecureCookie, true)
	c.SetCookie(cfg.CookieName+"_refresh", "", -1, "/v1/auth", cfg.CookieDomain, cfg.SecureCookie, true)
}
