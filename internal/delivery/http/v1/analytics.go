package v1

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"github.com/mrbelka12000/hz_zachem/internal/delivery/http/middleware"
	"github.com/mrbelka12000/hz_zachem/internal/service"
)

func (r *Router) spendingByCategory(c *gin.Context) {
	hid := middleware.MustHouseholdID(c)
	from, to, err := parseRange(c)
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	rows, err := r.svc.Analytics.SpendingByCategory(c.Request.Context(), hid, from, to)
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	ok(c, gin.H{"rows": rows})
}

func (r *Router) spendingByMonth(c *gin.Context) {
	hid := middleware.MustHouseholdID(c)
	months := 6
	if v := c.Query("months"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			middleware.Respond(c, service.ErrInvalidInput)
			return
		}
		months = n
	}
	rows, err := r.svc.Analytics.SpendingByMonth(c.Request.Context(), hid, months)
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	ok(c, gin.H{"rows": rows})
}

func (r *Router) topMerchants(c *gin.Context) {
	hid := middleware.MustHouseholdID(c)
	from, to, err := parseRange(c)
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	limit := 10
	if v := c.Query("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			middleware.Respond(c, service.ErrInvalidInput)
			return
		}
		limit = n
	}
	rows, err := r.svc.Analytics.TopMerchants(c.Request.Context(), hid, from, to, limit)
	if err != nil {
		middleware.Respond(c, err)
		return
	}
	ok(c, gin.H{"rows": rows})
}

func parseRange(c *gin.Context) (time.Time, time.Time, error) {
	fromStr := c.Query("from")
	toStr := c.Query("to")
	if fromStr == "" || toStr == "" {
		return time.Time{}, time.Time{}, service.ErrInvalidInput
	}
	from, err := time.Parse(time.RFC3339, fromStr)
	if err != nil {
		return time.Time{}, time.Time{}, service.ErrInvalidInput
	}
	to, err := time.Parse(time.RFC3339, toStr)
	if err != nil {
		return time.Time{}, time.Time{}, service.ErrInvalidInput
	}
	return from, to, nil
}
