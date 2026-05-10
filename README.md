# <service_name>

Шаблон микросервиса для QazEvent.

## Использование шаблона

### 1. Скопировать шаблон

```bash
cp -r template my-new-service
cd my-new-service
```

### 2. Заменить `<service_name>` на имя сервиса

```bash
# Linux
find . -type f -name "*.go" -exec sed -i 's/<service_name>/my-new-service/g' {} +
find . -type f -name "*.md" -exec sed -i 's/<service_name>/my-new-service/g' {} +
find . -type f -name "*.yml" -exec sed -i 's/<service_name>/my-new-service/g' {} +

# macOS
find . -type f -name "*.go" -exec sed -i '' 's/<service_name>/my-new-service/g' {} +
find . -type f -name "*.md" -exec sed -i '' 's/<service_name>/my-new-service/g' {} +
find . -type f -name "*.yml" -exec sed -i '' 's/<service_name>/my-new-service/g' {} +
```

### 3. Инициализировать git репозиторий

```bash
rm -rf .git
git init
git add .
git commit -m "Initial commit from template"
```

### 4. Настроить переменные окружения

```bash
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=postgres
export POSTGRES_DB=my-new-service_storage
export RABBITMQ_URL=amqp://guest:guest@localhost:5672/
export RABBITMQ_EXCHANGE=events
export RABBITMQ_QUEUE=my-queue
```

### 5. Запустить сервис

```bash
go mod tidy
go build -o bin/my-new-service ./cmd/main.go
./bin/my-new-service
```

## Структура проекта

```
.
├── cmd/
│   └── main.go              # Точка входа
├── internal/
│   ├── app/                 # Оркестрация приложения
│   ├── config/              # Конфигурация
│   ├── consumer/            # Потребитель сообщений из очереди
│   ├── models/              # Модели данных
│   ├── producer/            # Публикация сообщений в очередь
│   ├── repo/                # Слой доступа к данным (PostgreSQL)
│   ├── service/             # Бизнес-логика
│   └── worker/              # Воркеры для фоновых задач
├── pkg/
│   ├── server/              # HTTP сервер
│   ├── postgres/            # Клиент PostgreSQL
│   ├── rabbitmq/            # Клиент RabbitMQ
│   └── redis/               # Клиент Redis
├── migrations/              # SQL миграции
├── build/
│   └── Dockerfile           # Docker образ
├── deployment/
│   └── docker-compose.yml   # Docker Compose
└── .github/
    └── workflows/
        └── deploy.yml       # CI/CD pipeline
```

## Установка инструментов

Все инструменты устанавливаются локально в папку `bin/` проекта.

```bash
# Все инструменты сразу
make install-tools

# Только линтер
make install-lint

# Только migrate
make install-migrate
```

После установки в `bin/` появятся:
- `golangci-lint` — линтер
- `migrate` — миграции БД

## Команды (Makefile)

```bash
# Сборка
make build

# Запуск
make run

# Тесты
make test

# Тесты с покрытием
make test-cover

# Линтер
make lint

# Линтер с автофиксом
make lint-fix

# Миграции
make migrate-up          # применить все миграции
make migrate-down        # откатить последнюю миграцию
make migrate-create      # создать новую миграцию
make migrate-version     # текущая версия миграций
make migrate-force       # принудительно установить версию

# Зависимости
make deps

# Очистка
make clean

# Инфраструктура (Docker)
make infra-up            # поднять PostgreSQL, RabbitMQ
make infra-down          # остановить контейнеры
make infra-logs          # логи контейнеров
make infra-ps            # статус контейнеров
```

## Локальная инфраструктура

Docker Compose поднимает:
- **PostgreSQL** (порт 5432) — база данных
- **RabbitMQ** (порт 5672, UI: 15672) — очередь сообщений
- **Redis** (порт 6379, опционально) — кэш

```bash
# Поднять инфраструктуру
make infra-up

# С Redis
docker compose -f deployment/docker-compose.yml --profile with-redis up -d

# RabbitMQ Management UI
open http://localhost:15672  # guest:guest
```

## CI/CD

GitHub Actions автоматически:
- Запускает линтер и тесты на каждый коммит
- Валидирует миграции
- Деплоит в production при пуше в `main`
- Деплоит в development через workflow_dispatch

## Конфигурация

**Локальная разработка:** `CONFIG_PATH=config.yaml` (задаётся автоматически в `make run`)

**Продакшен:** `CONFIG_PATH` не задан — конфигурация читается из переменных окружения

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| `HTTP_PORT` | 8080 | Порт HTTP сервера |
| `POSTGRES_HOST` | localhost | Хост PostgreSQL |
| `POSTGRES_PORT` | 5432 | Порт PostgreSQL |
| `POSTGRES_USER` | postgres | Пользователь PostgreSQL |
| `POSTGRES_PASSWORD` | postgres | Пароль PostgreSQL |
| `POSTGRES_DB` | <service_name>_storage | База данных |
| `POSTGRES_SSLMODE` | disable | SSL режим |
| `RABBITMQ_URL` | amqp://guest:guest@localhost:5672/ | URL RabbitMQ |
| `RABBITMQ_EXCHANGE` | events | Exchange |
| `RABBITMQ_QUEUE` | parsed_places | Очередь |
| `WORKER_INTERVAL` | 1h | Интервал воркера |
