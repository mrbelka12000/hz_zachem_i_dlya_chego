package app

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"

	"github.com/mrbelka12000/hz_zachem/internal/config"
	v1 "github.com/mrbelka12000/hz_zachem/internal/delivery/http/v1"
	"github.com/mrbelka12000/hz_zachem/internal/producer"
	"github.com/mrbelka12000/hz_zachem/internal/repo"
	"github.com/mrbelka12000/hz_zachem/internal/service"
	"github.com/mrbelka12000/hz_zachem/migrations"
	"github.com/mrbelka12000/hz_zachem/pkg/postgres"
	"github.com/mrbelka12000/hz_zachem/pkg/rabbitmq"
	"github.com/mrbelka12000/hz_zachem/pkg/server"
)

func Run() {
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	cfg, err := config.Load()
	if err != nil {
		log.Printf("load config: %v", err)
		return
	}

	if err := runMigrations(cfg.Postgres.DSN()); err != nil {
		log.Printf("run migrations: %v", err)
		return
	}
	log.Println("migrations applied")

	db, err := postgres.New(ctx, cfg.Postgres)
	if err != nil {
		log.Printf("connect to postgres: %v", err)
		return
	}
	defer func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	}()
	log.Println("connected to postgres")

	rmq, err := rabbitmq.New(cfg.RabbitMQ)
	if err != nil {
		log.Printf("connect to rabbitmq: %v", err)
		return
	}
	defer rmq.Close()
	log.Println("connected to rabbitmq")

	repository := repo.New(db)
	svc := service.New(cfg.Auth, repository)
	_ = producer.New(rmq, cfg.RabbitMQ.Queue)

	router := v1.NewRouter(svc, cfg)
	srv := server.New(cfg.HTTP.Port, router.Init())

	go func() {
		log.Printf("starting http server on port %s", cfg.HTTP.Port)
		if err := srv.Start(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Println("http server error:", err)
			cancel()
			return
		}
	}()

	log.Println("application started")
	<-ctx.Done()
	log.Println("shutting down...")

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("http server shutdown error: %v", err)
	}
}

func runMigrations(dsn string) error {
	sqlDB, err := sql.Open("pgx", dsn)
	if err != nil {
		return fmt.Errorf("open postgres for migration: %w", err)
	}
	defer sqlDB.Close()

	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("set dialect postgres: %w", err)
	}

	goose.SetBaseFS(migrations.FS)

	if err := goose.Up(sqlDB, "."); err != nil {
		return fmt.Errorf("run migrations: %w", err)
	}

	return nil
}
