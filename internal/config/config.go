package config

import (
	"context"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/joho/godotenv"
	"github.com/sethvargo/go-envconfig"
	"gopkg.in/yaml.v3"
)

type Config struct {
	HTTP     HTTPConfig     `yaml:"http"     env:", prefix=HTTP_"`
	RabbitMQ RabbitMQConfig `yaml:"rabbitmq" env:", prefix=RABBITMQ_"`
	Postgres PostgresConfig `yaml:"postgres" env:", prefix=POSTGRES_"`
	Worker   WorkerConfig   `yaml:"worker"   env:", prefix=WORKER_"`
	Auth     AuthConfig     `yaml:"auth"     env:", prefix=AUTH_"`
	CORS     CORSConfig     `yaml:"cors"     env:", prefix=CORS_"`
	CSRF     CSRFConfig     `yaml:"csrf"     env:", prefix=CSRF_"`
	Telegram TelegramConfig `yaml:"telegram" env:", prefix=TELEGRAM_"`
}

// TelegramConfig is optional. When BotToken is empty, the notifier
// logs messages to stderr instead of calling the Bot API — this lets
// the budget feature ship without a real bot wired up.
type TelegramConfig struct {
	BotToken string `yaml:"bot_token" env:"BOT_TOKEN"`
}

type HTTPConfig struct {
	Port string `yaml:"port" env:"PORT, default=8080"`
}

// RabbitMQConfig is optional. The wiring exists for future budget
// recompute / alert flows but is unused at runtime today, so an empty
// URL means "skip RabbitMQ entirely" rather than failing startup.
type RabbitMQConfig struct {
	URL      string `yaml:"url"      env:"URL"`
	Exchange string `yaml:"exchange" env:"EXCHANGE"`
	Queue    string `yaml:"queue"    env:"QUEUE"`
}

type PostgresConfig struct {
	Host     string `yaml:"host"     env:"HOST, required"`
	Port     int    `yaml:"port"     env:"PORT, required"`
	User     string `yaml:"user"     env:"USER, required"`
	Password string `yaml:"password" env:"PASSWORD, required"`
	DBName   string `yaml:"dbname"   env:"DB, required"`
	SSLMode  string `yaml:"sslmode"  env:"SSLMODE, default=disable"`
}

func (c PostgresConfig) DSN() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
		c.User, c.Password, c.Host, c.Port, c.DBName, c.SSLMode)
}

type WorkerConfig struct {
	Interval time.Duration `yaml:"interval" env:"INTERVAL, default=1h"`
}

type AuthConfig struct {
	JWTSecret    string        `yaml:"jwt_secret"    env:"JWT_SECRET, required"`
	AccessTTL    time.Duration `yaml:"access_ttl"    env:"ACCESS_TTL, default=15m"`
	RefreshTTL   time.Duration `yaml:"refresh_ttl"   env:"REFRESH_TTL, default=720h"`
	CookieName   string        `yaml:"cookie_name"   env:"COOKIE_NAME, default=session"`
	CookieDomain string        `yaml:"cookie_domain" env:"COOKIE_DOMAIN"`
	SecureCookie bool          `yaml:"secure_cookie" env:"SECURE_COOKIE, default=true"`
}

type CORSConfig struct {
	AllowedOrigins []string `yaml:"allowed_origins" env:"ALLOWED_ORIGINS, delimiter=;"`
}

type CSRFConfig struct {
	Secret string `yaml:"secret" env:"SECRET"`
}

func Load() (*Config, error) {
	configPath := os.Getenv("CONFIG_PATH")
	if configPath != "" {
		return loadFromFile(configPath)
	}

	if err := godotenv.Load(); err != nil && !errors.Is(err, os.ErrNotExist) {
		return nil, fmt.Errorf("load .env: %w", err)
	}

	cfg := &Config{}
	if err := envconfig.Process(context.Background(), cfg); err != nil {
		return nil, fmt.Errorf("process env: %w", err)
	}
	applyDefaults(cfg)
	return cfg, nil
}

func loadFromFile(path string) (*Config, error) {
	data, err := os.ReadFile(path) // #nosec G304,G703 -- path is the operator-supplied CONFIG_PATH, not user input
	if err != nil {
		return nil, fmt.Errorf("read file: %w", err)
	}

	cfg := &Config{}
	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("unmarshal yaml: %w", err)
	}

	applyDefaults(cfg)
	return cfg, nil
}

func applyDefaults(cfg *Config) {
	if cfg.Auth.AccessTTL == 0 {
		cfg.Auth.AccessTTL = 15 * time.Minute
	}
	if cfg.Auth.RefreshTTL == 0 {
		cfg.Auth.RefreshTTL = 30 * 24 * time.Hour
	}
	if cfg.Auth.CookieName == "" {
		cfg.Auth.CookieName = "session"
	}
}
