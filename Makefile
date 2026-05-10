.PHONY: build run test lint migrate-up migrate-down migrate-create install-tools clean \
       infra-up infra-down infra-logs infra-ps

SERVICE_NAME ?= hz_zachem
MIGRATIONS_DIR = migrations
POSTGRES_DSN ?= postgres://postgres:postgres@localhost:5432/$(SERVICE_NAME)_storage?sslmode=disable
BIN_DIR = $(CURDIR)/bin
COMPOSE_FILE = deployment/docker-compose.yml

# Сборка
build:
	go build -o $(BIN_DIR)/$(SERVICE_NAME) ./cmd/main.go

# Запуск
run: build
	CONFIG_PATH=config.yaml $(BIN_DIR)/$(SERVICE_NAME)

# Тесты
test:
	go test -v -race ./...

test-cover:
	go test -v -race -coverprofile=coverage.out ./...
	go tool cover -html=coverage.out -o coverage.html

# Линтер
lint:
	$(BIN_DIR)/golangci-lint run

lint-fix:
	$(BIN_DIR)/golangci-lint run --fix

# Миграции
migrate-up:
	$(BIN_DIR)/migrate -path $(MIGRATIONS_DIR) -database "$(POSTGRES_DSN)" up

migrate-down:
	$(BIN_DIR)/migrate -path $(MIGRATIONS_DIR) -database "$(POSTGRES_DSN)" down 1

migrate-create:
	@read -p "Migration name: " name; \
	$(BIN_DIR)/migrate create -ext sql -dir $(MIGRATIONS_DIR) -seq $$name

migrate-version:
	$(BIN_DIR)/migrate -path $(MIGRATIONS_DIR) -database "$(POSTGRES_DSN)" version

migrate-force:
	@read -p "Version: " version; \
	$(BIN_DIR)/migrate -path $(MIGRATIONS_DIR) -database "$(POSTGRES_DSN)" force $$version

# Установка инструментов
install-tools: install-lint install-migrate

install-lint:
	GOBIN=$(BIN_DIR) go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest

install-migrate:
	GOBIN=$(BIN_DIR) go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# Зависимости
deps:
	go mod tidy
	go mod download

# Очистка
clean:
	rm -f coverage.out coverage.html

# Инфраструктура
infra-up:
	docker compose -f $(COMPOSE_FILE) up -d

infra-down:
	docker compose -f $(COMPOSE_FILE) down

infra-down-v:
	docker compose -f $(COMPOSE_FILE) down -v

infra-logs:
	docker compose -f $(COMPOSE_FILE) logs -f

infra-ps:
	docker compose -f $(COMPOSE_FILE) ps
