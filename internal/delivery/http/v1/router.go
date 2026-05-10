package v1

import (
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"github.com/qazevent/hz_zachem/internal/config"
	"github.com/qazevent/hz_zachem/internal/delivery/http/middleware"
	"github.com/qazevent/hz_zachem/internal/service"
)

type Router struct {
	svc *service.Service
	cfg *config.Config
}

func NewRouter(svc *service.Service, cfg *config.Config) *Router {
	return &Router{svc: svc, cfg: cfg}
}

const corsMaxAge = 12 * time.Hour

func (r *Router) Init() *gin.Engine {
	engine := gin.New()
	engine.Use(gin.Recovery())
	engine.Use(gin.Logger())

	if len(r.cfg.CORS.AllowedOrigins) > 0 {
		engine.Use(cors.New(cors.Config{
			AllowOrigins:     r.cfg.CORS.AllowedOrigins,
			AllowMethods:     []string{"GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"},
			AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "Idempotency-Key", "X-CSRF-Token"},
			ExposeHeaders:    []string{"Content-Length"},
			AllowCredentials: true,
			MaxAge:           corsMaxAge,
		}))
	}

	engine.GET("/healthz", r.healthz)
	engine.GET("/readyz", r.readyz)

	api := engine.Group("/v1")
	{
		auth := api.Group("/auth")
		{
			auth.POST("/register", r.register)
			auth.POST("/login", r.login)
			auth.POST("/refresh", r.refresh)
			auth.POST("/logout", r.logout)
		}

		protected := api.Group("")
		protected.Use(middleware.Auth(r.svc))
		{
			protected.GET("/me", r.me)
		}

		scoped := api.Group("")
		scoped.Use(middleware.Auth(r.svc), middleware.Household(r.svc))
		{
			scoped.GET("/accounts", r.listAccounts)
			scoped.POST("/accounts", r.createAccount)
			scoped.GET("/accounts/:id", r.getAccount)
			scoped.PUT("/accounts/:id", r.updateAccount)
			scoped.PATCH("/accounts/:id/archive", r.archiveAccount)
			scoped.PATCH("/accounts/:id/unarchive", r.unarchiveAccount)
			scoped.DELETE("/accounts/:id", r.deleteAccount)

			scoped.GET("/categories", r.listCategories)
			scoped.POST("/categories", r.createCategory)
			scoped.GET("/categories/:id", r.getCategory)
			scoped.PUT("/categories/:id", r.updateCategory)
			scoped.DELETE("/categories/:id", r.deleteCategory)

			scoped.GET("/transactions", r.listTransactions)
			scoped.POST("/transactions", r.createTransaction)
			scoped.POST("/transactions/transfer", r.createTransfer)
			scoped.GET("/transactions/:id", r.getTransaction)
			scoped.PUT("/transactions/:id", r.updateTransaction)
			scoped.DELETE("/transactions/:id", r.deleteTransaction)

			scoped.GET("/analytics/spending-by-category", r.spendingByCategory)
			scoped.GET("/analytics/spending-by-month", r.spendingByMonth)
			scoped.GET("/analytics/top-merchants", r.topMerchants)
		}
	}

	return engine
}
