package middleware

import (
	"github.com/gin-gonic/gin"

	"github.com/qazevent/hz_zachem/internal/service"
)

func Auth(svc *service.Service) gin.HandlerFunc {
	cookieName := svc.AuthConfig().CookieName
	return func(c *gin.Context) {
		token, err := c.Cookie(cookieName)
		if err != nil || token == "" {
			Respond(c, service.ErrUnauthorized)
			return
		}
		claims, err := svc.Auth.ParseAccess(token)
		if err != nil {
			Respond(c, err)
			return
		}
		setUserID(c, claims.UserID)
		c.Next()
	}
}
