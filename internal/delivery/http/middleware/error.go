package middleware

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/mrbelka12000/hz_zachem/internal/service"
)

type ErrorBody struct {
	Error ErrorDetail `json:"error"`
}

type ErrorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func Respond(c *gin.Context, err error) {
	status, code := classify(err)
	c.AbortWithStatusJSON(status, ErrorBody{Error: ErrorDetail{Code: code, Message: err.Error()}})
}

func classify(err error) (status int, code string) {
	switch {
	case errors.Is(err, service.ErrInvalidInput):
		return http.StatusBadRequest, "invalid_input"
	case errors.Is(err, service.ErrUnauthorized), errors.Is(err, service.ErrTokenExpired):
		return http.StatusUnauthorized, "unauthorized"
	case errors.Is(err, service.ErrInvalidCredentials):
		return http.StatusUnauthorized, "invalid_credentials"
	case errors.Is(err, service.ErrForbidden):
		return http.StatusForbidden, "forbidden"
	case errors.Is(err, service.ErrNotFound):
		return http.StatusNotFound, "not_found"
	case errors.Is(err, service.ErrConflict):
		return http.StatusConflict, "conflict"
	case errors.Is(err, service.ErrCurrencyMismatch):
		return http.StatusBadRequest, "currency_mismatch"
	case errors.Is(err, service.ErrTransferSameAccount):
		return http.StatusBadRequest, "transfer_same_account"
	default:
		return http.StatusInternalServerError, "internal_error"
	}
}
