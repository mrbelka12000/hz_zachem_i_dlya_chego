# hz_zachem

Семейный трекер бюджета: учёт расходов и доходов по нескольким счетам в KZT/USD/EUR,
правила автокатегоризации, бюджеты с алертами в Telegram, CSV-импорт банковских выписок.

Бэкенд на Go (Gin + GORM + PostgreSQL) отдаёт JSON API под `/v1/*`,
плюс встроенный React 19 SPA (Vite + TanStack Query + Tailwind v4) под все остальные GET-маршруты —
один бинарь, одна точка деплоя.

---

## Возможности

- **Аккаунты** в KZT/USD/EUR — cash / card / bank / other / **debt** (отрицательный = ты должен,
  положительный = должны тебе)
- **Иерархические категории** (родитель → дети), мягкое удаление со ссылочной целостностью
  на уровне БД
- **Правила автокатегоризации** — массив подстрок (`["restaurant", "cafe"]`) → категория «Food».
  Применяются при создании транзакции и кнопкой «Apply to uncategorized» к истории
- **Бюджеты** — месячный лимит на категорию или общий. Алерты при 50% / 80% / 100% уходят в Telegram
  всем участникам домохозяйства, чей `chat_id` привязан
- **Переводы** — пара expense+income с общим `transfer_id` и `transfer_direction`, исключаются из
  cashflow и spend-аналитики, но участвуют в балансе аккаунта
- **CSV-импорт** с авто-парингом и дедупом через `external_hash`
- **Аналитика** — расходы по категориям, доходы по категориям, топ мерчантов, cashflow по месяцам,
  баланс на счёт, KPI Net worth / This month / Spent / Needs review на дашборде

---

## Технологии

| Слой       | Технологии                                                              |
|------------|-------------------------------------------------------------------------|
| Backend    | Go 1.25, Gin, GORM, Goose (миграции), shopspring/decimal, JWT, bcrypt   |
| Frontend   | React 19, TypeScript, Vite 8, Tailwind v4, TanStack Query, decimal.js   |
| Хранилище  | PostgreSQL 16 (требуется PG15+ из-за `ON DELETE SET NULL (column)`)     |
| Очереди    | RabbitMQ 3.13 (подключение есть, потребителей пока нет)                  |
| Уведомления| Telegram Bot API (опционально)                                           |
| Деплой     | Docker, Docker Swarm, GitHub Actions                                     |

---

## Локальный запуск

### Требования

- Go 1.25+
- Node 24+ (для сборки SPA)
- Docker + Docker Compose (для локальной инфраструктуры)
- `make`

### Первый запуск

```bash
# 1. Установить локальные инструменты в ./bin/ (golangci-lint, migrate)
make install-tools

# 2. Поднять Postgres + RabbitMQ
make infra-up

# 3. Установить npm-зависимости и собрать SPA
make web-install
make web-build

# 4. Поднять API (миграции применятся через Goose автоматически на старте)
make run
```

Открыть http://localhost:8080 — увидишь логин-страницу SPA.
API доступен на `http://localhost:8080/v1/*`.

### Разработка фронтенда

```bash
# В отдельном терминале с hot-reload
make web-dev    # http://localhost:5173 → проксирует /v1 на :8080
```

### Команды Makefile

```bash
make build         # web-build + go build (бинарь embed'ит dist/)
make run           # build + run с CONFIG_PATH=internal/config/config.yaml
make test          # go test -v -race ./...
make test-cover    # + coverage.html
make lint          # ./bin/golangci-lint run
make lint-fix      # с автофиксом

make web-install   # cd web && npm ci
make web-dev       # vite dev server
make web-build     # сборка SPA в web/dist/

make infra-up      # Postgres + RabbitMQ
make infra-down    # стоп
make migrate-up    # применить миграции через CLI (Goose-аннотации; см. CLAUDE.md)
```

### Smoke-тесты

```bash
scripts/testing/smoke.sh                  # полный E2E через curl
scripts/testing/auth.sh register          # отдельные шаги; cookie-jar в /tmp/hz_zachem_cookies.txt
```

---

## Конфигурация

Две схемы:

- **Файл-режим** — задан `CONFIG_PATH`, читается YAML (`internal/config/config.yaml`). Это то, что
  использует `make run`.
- **Env-режим** — `CONFIG_PATH` пустой, `joho/godotenv` подтягивает `.env` если есть,
  `sethvargo/go-envconfig` маппит ENV в структуру. Так работает Docker-образ.

Скопируй `.env.example` → `.env` для локала в env-режиме.

| Переменная                | По умолчанию          | Описание                                          |
|---------------------------|-----------------------|---------------------------------------------------|
| `HTTP_PORT`               | `8080`                | Порт HTTP                                         |
| `POSTGRES_HOST`           | `localhost`           |                                                   |
| `POSTGRES_PORT`           | `5432`                |                                                   |
| `POSTGRES_USER`           | `postgres`            |                                                   |
| `POSTGRES_PASSWORD`       | `postgres`            |                                                   |
| `POSTGRES_DB`             | `hz_zachem_storage`   |                                                   |
| `POSTGRES_SSLMODE`        | `disable`             | `require` для managed-Postgres                   |
| `RABBITMQ_URL`            | `amqp://guest:guest@localhost:5672/` | Не блокирует старт, если AMQP недоступен |
| `RABBITMQ_EXCHANGE`       | `events`              |                                                   |
| `RABBITMQ_QUEUE`          | `parsed_places`       |                                                   |
| `AUTH_JWT_SECRET`         | **обязательно**       | Подпись access-токена. 32+ байта random          |
| `AUTH_ACCESS_TTL`         | `15m`                 | TTL JWT                                           |
| `AUTH_REFRESH_TTL`        | `720h`                | TTL refresh-токена (хранится sha256-хэшем)        |
| `AUTH_COOKIE_NAME`        | `session`             |                                                   |
| `CSRF_SECRET`             | **обязательно**       | 32+ байта random для double-submit cookie         |
| `CORS_ALLOWED_ORIGINS`    | —                     | CSV; для prod указать домен SPA если он на другом origin |
| `TELEGRAM_BOT_TOKEN`      | пусто                 | Если пусто → алерты только в stderr (no-op send)  |

---

## Установка на VPS через Docker

Деплой использует **Docker Swarm**: на VPS крутится один stack-сервис `finance_service`,
GitHub Actions пушит образ в Docker Hub и через SSH делает `docker service update --image @sha256:…`.
Пин по digest — без него Swarm видит ту же `:latest`-строку и не перетягивает образ.

### Что должно быть на VPS

- Linux с Docker 24+ и Docker Compose plugin
- Открытые порты: `80/443` (или порт reverse-proxy перед бинарём), исходящий доступ к Docker Hub
- Доступ по SSH с публичным ключом (нужен для CI deploy)
- Свободный PostgreSQL 15+ (managed или контейнером — см. ниже)

### Шаг 1. Подготовить VPS

```bash
# На VPS под root или sudo-юзером
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Включить Swarm-режим (даже на одной ноде — для service update)
docker swarm init
```

### Шаг 2. Залогиниться в Docker Hub

Образ публичный (`mrbelka12000/hz_zachem`), но `--with-registry-auth` форвардит креды воркерам.
Если репо приватный — без `docker login` на manager-ноде сервис не поднимется.

```bash
echo "$DOCKERHUB_PASSWORD" | docker login -u mrbelka12000 --password-stdin
```

### Шаг 3. Поднять PostgreSQL

**Вариант A — managed Postgres** (рекомендую для prod): получи строку подключения у провайдера.

**Вариант B — Postgres контейнером рядом** (одна нода, быстрый старт):

```bash
docker run -d --name pg \
  --restart unless-stopped \
  -e POSTGRES_PASSWORD='<strong-random>' \
  -e POSTGRES_DB=hz_zachem_storage \
  -v hz_pgdata:/var/lib/postgresql/data \
  -p 127.0.0.1:5432:5432 \
  postgres:16-alpine
```

Подключение: `host=<vps-ip>` или `host=host.docker.internal` если сервис в той же сети.
Для Swarm-сервиса проще использовать overlay-сеть или хост-сеть.

### Шаг 4. Сложить секреты в env-файл на VPS

```bash
sudo mkdir -p /etc/hz_zachem
sudo tee /etc/hz_zachem/app.env >/dev/null <<'EOF'
HTTP_PORT=8080

POSTGRES_HOST=<pg-host>
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<strong-random>
POSTGRES_DB=hz_zachem_storage
POSTGRES_SSLMODE=disable

# 32+ байта рандома: openssl rand -hex 32
AUTH_JWT_SECRET=<random-32-bytes-hex>
CSRF_SECRET=<random-32-bytes-hex>

CORS_ALLOWED_ORIGINS=https://your-domain.example

# Опционально — Telegram-бот для бюджетных алертов
TELEGRAM_BOT_TOKEN=<bot-token-from-BotFather-or-empty>
EOF
sudo chmod 600 /etc/hz_zachem/app.env
```

### Шаг 5. Первый запуск Swarm-сервиса

```bash
docker service create \
  --name finance_service \
  --replicas 1 \
  --update-order start-first \
  --update-failure-action rollback \
  --env-file /etc/hz_zachem/app.env \
  --publish published=8080,target=8080 \
  --with-registry-auth \
  mrbelka12000/hz_zachem:latest
```

Через ~10 секунд:

```bash
docker service ps finance_service           # должен показать Running
curl -fsS http://localhost:8080/healthz     # ok
```

Goose накатит миграции при старте — отдельных шагов не нужно.

### Шаг 6. Reverse-proxy и HTTPS

Бинарь слушает 8080 plain HTTP. На prod ставится Caddy/Traefik/nginx перед ним для TLS.
Пример Caddyfile:

```caddyfile
your-domain.example {
  reverse_proxy 127.0.0.1:8080
}
```

### Шаг 7. Настроить GitHub Actions для авто-деплоя

В Settings → Secrets and variables → Actions добавить:

| Secret           | Что туда                                                          |
|------------------|-------------------------------------------------------------------|
| `PASSWORD`       | Docker Hub password / access token владельца `mrbelka12000`       |
| `SSH_PRIV_KEY`   | Приватный ключ для SSH-доступа к VPS                              |
| `SSH_PUB_KEY`    | Парный публичный ключ (его же `cat >> ~/.ssh/authorized_keys` на VPS) |
| `USER_IP`        | `user@vps-ip` или `user@vps-host`                                 |

Деплой запускается через **workflow_dispatch** (`Actions → CI/CD → Run workflow → development`),
поднимает образ, пушит в Docker Hub, и через SSH обновляет сервис:

```
docker service update --with-registry-auth --force \
  --image 'mrbelka12000/hz_zachem@sha256:<digest>' finance_service
```

### Ручное обновление

```bash
# на любой машине с docker login
docker pull mrbelka12000/hz_zachem:latest
DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' mrbelka12000/hz_zachem:latest)

# на VPS
ssh user@vps "docker service update --with-registry-auth --force --image '$DIGEST' finance_service"
```

### Диагностика

```bash
docker service ps finance_service                 # история тасков (running / failed / shutdown)
docker service logs -f finance_service            # tail логов
docker service inspect --pretty finance_service   # текущая конфигурация (image, env, replicas)
docker exec -it $(docker ps -qf name=finance_service) sh   # внутрь контейнера

# проверка БД-подключения изнутри контейнера
docker exec -it $(docker ps -qf name=finance_service) wget -qO- localhost:8080/healthz
```

### Откат на предыдущий образ

```bash
docker service rollback finance_service
```

### Бэкап Postgres (если контейнером)

```bash
docker exec pg pg_dump -U postgres hz_zachem_storage | gzip > backup-$(date +%F).sql.gz
```

---

## Telegram-бот (опционально)

1. Создать бота через `@BotFather`, скопировать токен.
2. Прописать `TELEGRAM_BOT_TOKEN=<token>` в `/etc/hz_zachem/app.env`, перезапустить сервис.
3. Открыть бота в Telegram и нажать **Start** (иначе бот не сможет писать тебе).
4. Узнать свой numeric chat_id у `@userinfobot`.
5. На сайте: **Settings → Telegram chat ID** → вставить → Save.
6. Создать тестовый бюджет с маленькой суммой и записать одну трату ≥50% — должен прийти DM.

Если `TELEGRAM_BOT_TOKEN` пустой — алерты пишутся только в stderr приложения (no-op send),
сама бизнес-логика бюджетов работает.

---

## Структура проекта

```
.
├── cmd/main.go                 # one-liner → internal/app.Run()
├── internal/
│   ├── app/                    # лайфцикл: миграции → Postgres → MQ → service → HTTP
│   ├── config/                 # YAML + env-loader
│   ├── delivery/http/
│   │   ├── middleware/         # Auth / Household / CSRF / Respond
│   │   └── v1/                 # один handler-file на ресурс + router.go
│   ├── integrations/
│   │   ├── csv/                # CSV-парсер для импорта
│   │   └── telegram/           # Bot API client (sendMessage)
│   ├── models/                 # GORM-теги + доменные enum'ы (Money = decimal.Decimal)
│   ├── repo/                   # один sub-repo на агрегат + AnalyticsRepo (raw SQL)
│   ├── service/                # бизнес-логика; sentinel-ошибки тут же
│   └── ...
├── migrations/                 # Goose-аннотированные .sql, embed.FS
├── web/                        # React SPA
│   ├── src/
│   │   ├── api/                # apiFetch + per-resource clients
│   │   ├── pages/              # один каталог на ресурс
│   │   ├── lib/                # money / dates / rates / aggregations / transactions (helpers)
│   │   └── components/, auth/, theme/
│   └── web.go                  # //go:embed all:dist
├── build/Dockerfile            # multi-stage: node → go → alpine
├── deployment/docker-compose.yml  # локальная инфра (PG + RabbitMQ + опц. Redis)
├── pkg/{server,postgres,rabbitmq,redis}/   # reusable клиенты
├── scripts/testing/            # curl-based smoke + per-resource scripts
└── .github/workflows/deploy.yml
```

---

## CI/CD

GitHub Actions (`.github/workflows/deploy.yml`):

1. **Lint** — `golangci-lint`
2. **Unit tests** — `go test -v -race ./...`
3. **Validate migrations** — проверяет формат имён и наличие `+goose Up/Down`
4. **Deploy to Development** (только через `workflow_dispatch`):
   - `docker build` → `docker push <owner>/hz_zachem`
   - снимает `RepoDigest` `<owner>/hz_zachem@sha256:…`
   - SSH на VPS → `docker service update --with-registry-auth --force --image @sha256:… finance_service`

Push в `main` сейчас не триггерит автодеплой — только ручной запуск из вкладки Actions.
