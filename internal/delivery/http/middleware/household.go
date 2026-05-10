package middleware

import (
	"github.com/gin-gonic/gin"

	"github.com/qazevent/hz_zachem/internal/service"
)

func Household(svc *service.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID, ok := UserID(c)
		if !ok {
			Respond(c, service.ErrUnauthorized)
			return
		}
		hid, err := svc.Households.PrimaryID(c.Request.Context(), userID)
		if err != nil {
			Respond(c, err)
			return
		}
		member, err := svc.Households.RequireMembership(c.Request.Context(), userID, hid)
		if err != nil {
			Respond(c, err)
			return
		}
		setHouseholdID(c, hid)
		setRole(c, member.Role)
		c.Next()
	}
}
