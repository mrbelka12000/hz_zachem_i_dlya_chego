## SPA build — produces web/dist consumed by //go:embed in the next stage.
FROM node:24-alpine AS web

WORKDIR /web

COPY web/package.json web/package-lock.json ./
# `npm install` (not `npm ci`) because the lockfile is resolved on the
# developer's macOS and lacks the Linux-only optional native deps that
# Tailwind v4 / Vite pull in. Matches the `web-build` Makefile target.
RUN npm install --no-audit --no-fund

COPY web/ ./
RUN npm run build

## Go build
FROM golang:1.25-alpine AS buildenv

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
# Drop in the freshly built SPA so //go:embed all:dist has something
# to pick up. .dockerignore prevents the host's web/dist from leaking in.
COPY --from=web /web/dist ./web/dist

ENV GO111MODULE=on
RUN CGO_ENABLED=0 go build -o /out/hz_zachem ./cmd/main.go

## Runtime
FROM alpine

RUN apk add --no-cache curl ca-certificates tzdata

COPY --from=buildenv /out/hz_zachem /hz_zachem

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/healthz || exit 1

CMD ["/hz_zachem"]
