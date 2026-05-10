package v1

import (
	"github.com/gin-gonic/gin"
	"github.com/qazevent/<service_name>/internal/service"
)

type Router struct {
	svc *service.Service
}

func NewRouter(svc *service.Service) *Router {
	return &Router{svc: svc}
}

func (r *Router) Init() *gin.Engine {
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(gin.Logger())

	router.GET("/healthz", r.healthz)
	router.GET("/readyz", r.readyz)

	// TODO: add your routes here
	// api := router.Group("/api/v1")
	// {
	// }

	return router
}
