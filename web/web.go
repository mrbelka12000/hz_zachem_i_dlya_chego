// Package web exposes the Vite-built SPA bundle to the Go binary.
//
// The Vite build writes to `web/dist/`; this package embeds that directory
// so the same Go binary can serve the frontend without a separate static
// host.
//
// `make web-build` (or `npm run build` inside web/) must run before
// `go build` so the embed has something to pick up.
package web

import (
	"embed"
	"errors"
	"io/fs"
)

//go:embed all:dist
var distFS embed.FS

// Assets returns a sub-filesystem rooted at `dist/assets`. Mount it under
// /assets in Gin for the hashed JS/CSS chunks.
func Assets() (fs.FS, error) {
	return fs.Sub(distFS, "dist/assets")
}

// Dist returns a sub-filesystem rooted at `dist`. Use it for files that
// live at the SPA root (favicon, icons, etc.).
func Dist() (fs.FS, error) {
	return fs.Sub(distFS, "dist")
}

// IndexHTML returns the embedded `dist/index.html` body. The HTTP layer
// serves it for any non-API GET (history-mode SPA fallback).
func IndexHTML() ([]byte, error) {
	data, err := distFS.ReadFile("dist/index.html")
	if err != nil {
		return nil, errors.New("web: dist/index.html missing — run `make web-build` before `go build`")
	}
	return data, nil
}
