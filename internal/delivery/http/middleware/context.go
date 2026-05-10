package middleware

import (
	"github.com/gin-gonic/gin"

	"github.com/qazevent/hz_zachem/internal/models"
)

const (
	ctxUserID      = "auth.user_id"
	ctxHouseholdID = "auth.household_id"
	ctxRole        = "auth.role"
)

func UserID(c *gin.Context) (models.ID, bool) {
	v, ok := c.Get(ctxUserID)
	if !ok {
		return models.ID{}, false
	}
	id, ok := v.(models.ID)
	return id, ok
}

func MustUserID(c *gin.Context) models.ID {
	id, _ := UserID(c)
	return id
}

func HouseholdID(c *gin.Context) (models.ID, bool) {
	v, ok := c.Get(ctxHouseholdID)
	if !ok {
		return models.ID{}, false
	}
	id, ok := v.(models.ID)
	return id, ok
}

func MustHouseholdID(c *gin.Context) models.ID {
	id, _ := HouseholdID(c)
	return id
}

func Role(c *gin.Context) (models.Role, bool) {
	v, ok := c.Get(ctxRole)
	if !ok {
		return "", false
	}
	r, ok := v.(models.Role)
	return r, ok
}

func setUserID(c *gin.Context, id models.ID)      { c.Set(ctxUserID, id) }
func setHouseholdID(c *gin.Context, id models.ID) { c.Set(ctxHouseholdID, id) }
func setRole(c *gin.Context, role models.Role)    { c.Set(ctxRole, role) }
