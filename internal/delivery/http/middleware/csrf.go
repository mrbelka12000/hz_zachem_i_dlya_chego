package middleware

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/mrbelka12000/hz_zachem/internal/config"
)

const (
	csrfCookieName = "csrf_token"
	csrfHeaderName = "X-CSRF-Token"
	csrfTokenBytes = 32
	csrfMaxAge     = 24 * 60 * 60 // 24h
)

// CSRF returns a Gin middleware implementing the double-submit cookie
// pattern. On safe methods it ensures a `csrf_token` cookie exists. On
// state-changing methods it requires `X-CSRF-Token` to match the cookie.
//
// The cookie is intentionally NOT HttpOnly so the SPA can read it and
// echo it back. Combined with `SameSite=Lax`, this defeats classic
// cross-site form-submission CSRF.
func CSRF(cfg config.CSRFConfig) gin.HandlerFunc {
	_ = cfg // reserved for future HMAC-signed tokens
	return func(c *gin.Context) {
		token := readCSRFCookie(c)

		if isSafeMethod(c.Request.Method) {
			if token == "" {
				newToken, err := generateCSRFToken()
				if err != nil {
					Respond(c, err)
					return
				}
				token = newToken
				writeCSRFCookie(c, token)
			}
			c.Next()
			return
		}

		header := c.GetHeader(csrfHeaderName)
		if token == "" || header == "" || subtle.ConstantTimeCompare([]byte(token), []byte(header)) != 1 {
			c.AbortWithStatusJSON(http.StatusForbidden, ErrorBody{
				Error: ErrorDetail{Code: "csrf", Message: "csrf token missing or invalid"},
			})
			return
		}
		c.Next()
	}
}

func isSafeMethod(method string) bool {
	switch method {
	case http.MethodGet, http.MethodHead, http.MethodOptions:
		return true
	}
	return false
}

func readCSRFCookie(c *gin.Context) string {
	v, err := c.Cookie(csrfCookieName)
	if err != nil {
		return ""
	}
	return v
}

func writeCSRFCookie(c *gin.Context, token string) {
	c.SetSameSite(http.SameSiteLaxMode)
	// secure=false so the local dev SPA over http works. In production
	// fronted by HTTPS, browsers still honor SameSite=Lax to block the
	// cross-site request paths CSRF actually targets.
	c.SetCookie(csrfCookieName, token, csrfMaxAge, "/", "", false, false)
}

func generateCSRFToken() (string, error) {
	b := make([]byte, csrfTokenBytes)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
