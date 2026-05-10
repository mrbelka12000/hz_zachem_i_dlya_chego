package v1

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type healthResponse struct {
	Status string `json:"status"`
}

func (r *Router) healthz(c *gin.Context) {
	c.JSON(http.StatusOK, healthResponse{Status: "ok"})
}

func (r *Router) readyz(c *gin.Context) {
	// TODO: add dependency checks (db, rabbitmq, etc.)
	c.JSON(http.StatusOK, healthResponse{Status: "ok"})
}
