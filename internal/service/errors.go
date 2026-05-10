package service

import "errors"

var (
	ErrInvalidInput       = errors.New("service: invalid input")
	ErrUnauthorized       = errors.New("service: unauthorized")
	ErrForbidden          = errors.New("service: forbidden")
	ErrNotFound           = errors.New("service: not found")
	ErrConflict           = errors.New("service: conflict")
	ErrCurrencyMismatch   = errors.New("service: currency mismatch with household")
	ErrTransferSameAccount = errors.New("service: transfer source and destination must differ")
	ErrInvalidCredentials = errors.New("service: invalid credentials")
	ErrTokenExpired       = errors.New("service: token expired or revoked")
)
