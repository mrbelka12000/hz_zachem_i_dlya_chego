package v1

import (
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"github.com/mrbelka12000/hz_zachem/internal/config"
	"github.com/mrbelka12000/hz_zachem/internal/delivery/http/middleware"
	"github.com/mrbelka12000/hz_zachem/internal/service"
	"github.com/mrbelka12000/hz_zachem/web"
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

	engine.Use(middleware.CSRF(r.cfg.CSRF))

	engine.GET("/healthz", r.healthz)
	engine.GET("/readyz", r.readyz)

	api := engine.Group("/v1")
	r.mountAuthRoutes(api)
	r.mountAuthenticatedRoutes(api)
	r.mountScopedRoutes(api)

	mountSPA(engine)

	return engine
}

func (r *Router) mountAuthRoutes(api *gin.RouterGroup) {
	auth := api.Group("/auth")
	auth.POST("/register", r.register)
	auth.POST("/login", r.login)
	auth.POST("/refresh", r.refresh)
	auth.POST("/logout", r.logout)
}

func (r *Router) mountAuthenticatedRoutes(api *gin.RouterGroup) {
	protected := api.Group("")
	protected.Use(middleware.Auth(r.svc))
	protected.GET("/me", r.me)
	protected.PATCH("/me/telegram", r.setTelegram)
}

func (r *Router) mountScopedRoutes(api *gin.RouterGroup) {
	scoped := api.Group("")
	scoped.Use(middleware.Auth(r.svc), middleware.Household(r.svc))

	scoped.GET("/accounts", r.listAccounts)
	scoped.POST("/accounts", r.createAccount)
	scoped.GET("/accounts/balances", r.listAccountBalances)
	scoped.GET("/accounts/:id", r.getAccount)
	scoped.GET("/accounts/:id/balance", r.getAccountBalance)
	scoped.PUT("/accounts/:id", r.updateAccount)
	scoped.PATCH("/accounts/:id/archive", r.archiveAccount)
	scoped.PATCH("/accounts/:id/unarchive", r.unarchiveAccount)
	scoped.DELETE("/accounts/:id", r.deleteAccount)

	scoped.GET("/categories", r.listCategories)
	scoped.POST("/categories", r.createCategory)
	scoped.GET("/categories/:id", r.getCategory)
	scoped.PUT("/categories/:id", r.updateCategory)
	scoped.DELETE("/categories/:id", r.deleteCategory)

	scoped.GET("/categorization-rules", r.listRules)
	scoped.POST("/categorization-rules", r.createRule)
	scoped.POST("/categorization-rules/apply", r.applyRules)
	scoped.GET("/categorization-rules/:id", r.getRule)
	scoped.PUT("/categorization-rules/:id", r.updateRule)
	scoped.DELETE("/categorization-rules/:id", r.deleteRule)

	scoped.GET("/budgets", r.listBudgets)
	scoped.POST("/budgets", r.createBudget)
	scoped.GET("/budgets/status", r.listBudgetStatuses)
	scoped.GET("/budgets/:id", r.getBudget)
	scoped.PUT("/budgets/:id", r.updateBudget)
	scoped.DELETE("/budgets/:id", r.deleteBudget)

	scoped.GET("/transactions", r.listTransactions)
	scoped.POST("/transactions", r.createTransaction)
	scoped.POST("/transactions/transfer", r.createTransfer)
	scoped.POST("/transactions/pair-transfers", r.pairTransfers)
	scoped.GET("/transactions/:id", r.getTransaction)
	scoped.PUT("/transactions/:id", r.updateTransaction)
	scoped.POST("/transactions/:id/unpair", r.unpairTransfer)
	scoped.DELETE("/transactions/:id", r.deleteTransaction)

	scoped.GET("/analytics/spending-by-category", r.spendingByCategory)
	scoped.GET("/analytics/spending-by-month", r.spendingByMonth)
	scoped.GET("/analytics/top-merchants", r.topMerchants)
	scoped.GET("/analytics/income-by-category", r.incomeByCategory)
	scoped.GET("/analytics/cashflow-by-month", r.cashflowByMonth)

	scoped.POST("/imports/csv", r.importCSV)
}

// mountSPA serves the embedded Vite bundle:
//   - /assets/*  -> hashed JS/CSS chunks from web/dist/assets
//   - everything else (non-API, GET) -> dist/index.html for client routing
func mountSPA(engine *gin.Engine) {
	assets, err := web.Assets()
	if err != nil {
		log.Printf("web: assets unavailable: %v", err)
	} else {
		engine.StaticFS("/assets", http.FS(assets))
	}

	index, err := web.IndexHTML()
	if err != nil {
		log.Printf("web: %v (SPA fallback disabled)", err)
		return
	}

	dist, _ := web.Dist()
	engine.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path

		// API and probes never fall through to the SPA.
		if strings.HasPrefix(path, "/v1/") || path == "/healthz" || path == "/readyz" {
			c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"code": "not_found", "message": "route not found"}})
			return
		}

		if c.Request.Method != http.MethodGet && c.Request.Method != http.MethodHead {
			c.Status(http.StatusMethodNotAllowed)
			return
		}

		// Try to serve a top-level static file first (favicon, icons, etc.).
		if dist != nil && path != "/" {
			rel := strings.TrimPrefix(path, "/")
			if f, err := dist.Open(rel); err == nil {
				_ = f.Close()
				http.ServeFileFS(c.Writer, c.Request, dist, rel)
				return
			}
		}

		// Otherwise hand back index.html so React Router can take over.
		c.Data(http.StatusOK, "text/html; charset=utf-8", index)
	})
}
