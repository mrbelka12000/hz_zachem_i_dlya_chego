package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"gopkg.in/yaml.v3"
)

type Config struct {
	HTTP     HTTPConfig     `yaml:"http"`
	RabbitMQ RabbitMQConfig `yaml:"rabbitmq"`
	Postgres PostgresConfig `yaml:"postgres"`
	Worker   WorkerConfig   `yaml:"worker"`
}

type HTTPConfig struct {
	Port string `yaml:"port"`
}

type RabbitMQConfig struct {
	URL      string `yaml:"url"`
	Exchange string `yaml:"exchange"`
	Queue    string `yaml:"queue"`
}

type PostgresConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	User     string `yaml:"user"`
	Password string `yaml:"password"`
	DBName   string `yaml:"dbname"`
	SSLMode  string `yaml:"sslmode"`
}

func (c PostgresConfig) DSN() string {
	return fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
		c.User, c.Password, c.Host, c.Port, c.DBName, c.SSLMode)
}

type WorkerConfig struct {
	Interval time.Duration `yaml:"interval"`
}

func Load() (*Config, error) {
	configPath := os.Getenv("CONFIG_PATH")
	if configPath != "" {
		return loadFromFile(configPath)
	}

	return loadFromEnv()
}

func loadFromFile(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read file: %w", err)
	}

	cfg := &Config{}
	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("unmarshal yaml: %w", err)
	}

	return cfg, nil
}

func loadFromEnv() (*Config, error) {
	port, err := strconv.Atoi(mustGetEnv("POSTGRES_PORT"))
	if err != nil {
		return nil, fmt.Errorf("invalid POSTGRES_PORT: %w", err)
	}

	interval, err := time.ParseDuration(getEnv("WORKER_INTERVAL", "1h"))
	if err != nil {
		return nil, fmt.Errorf("invalid WORKER_INTERVAL: %w", err)
	}

	return &Config{
		HTTP: HTTPConfig{
			Port: getEnv("HTTP_PORT", "8080"),
		},
		Postgres: PostgresConfig{
			Host:     mustGetEnv("POSTGRES_HOST"),
			Port:     port,
			User:     mustGetEnv("POSTGRES_USER"),
			Password: mustGetEnv("POSTGRES_PASSWORD"),
			DBName:   mustGetEnv("POSTGRES_DB"),
			SSLMode:  getEnv("POSTGRES_SSLMODE", "disable"),
		},
		RabbitMQ: RabbitMQConfig{
			URL:      mustGetEnv("RABBITMQ_URL"),
			Exchange: mustGetEnv("RABBITMQ_EXCHANGE"),
			Queue:    mustGetEnv("RABBITMQ_QUEUE"),
		},
		Worker: WorkerConfig{
			Interval: interval,
		},
	}, nil
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func mustGetEnv(key string) string {
	val := os.Getenv(key)
	if val == "" {
		panic(fmt.Sprintf("environment variable %s is required", key))
	}
	return val
}
