package rabbitmq

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/mrbelka12000/hz_zachem/internal/config"
	amqp "github.com/rabbitmq/amqp091-go"
)

type Client struct {
	conn    *amqp.Connection
	channel *amqp.Channel
	cfg     config.RabbitMQConfig
	mu      sync.RWMutex
}

func New(cfg config.RabbitMQConfig) (*Client, error) {
	c := &Client{cfg: cfg}

	if err := c.connect(); err != nil {
		return nil, err
	}

	return c, nil
}

func (c *Client) connect() error {
	conn, err := amqp.Dial(c.cfg.URL)
	if err != nil {
		return fmt.Errorf("dial rabbitmq: %w", err)
	}

	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return fmt.Errorf("open channel: %w", err)
	}

	if err := ch.ExchangeDeclare(
		c.cfg.Exchange,
		"direct",
		true,  // durable
		false, // auto-deleted
		false, // internal
		false, // no-wait
		nil,
	); err != nil {
		ch.Close()
		conn.Close()
		return fmt.Errorf("declare exchange: %w", err)
	}

	_, err = ch.QueueDeclare(
		c.cfg.Queue,
		true,  // durable
		false, // delete when unused
		false, // exclusive
		false, // no-wait
		nil,
	)
	if err != nil {
		ch.Close()
		conn.Close()
		return fmt.Errorf("declare queue: %w", err)
	}

	if err := ch.QueueBind(
		c.cfg.Queue,
		c.cfg.Queue, // routing key
		c.cfg.Exchange,
		false,
		nil,
	); err != nil {
		ch.Close()
		conn.Close()
		return fmt.Errorf("bind queue: %w", err)
	}

	c.mu.Lock()
	c.conn = conn
	c.channel = ch
	c.mu.Unlock()

	return nil
}

func (c *Client) Publish(ctx context.Context, routingKey string, body []byte) error {
	c.mu.RLock()
	ch := c.channel
	c.mu.RUnlock()

	return ch.PublishWithContext(
		ctx,
		c.cfg.Exchange,
		routingKey,
		false, // mandatory
		false, // immediate
		amqp.Publishing{
			ContentType:  "application/json",
			DeliveryMode: amqp.Persistent,
			Timestamp:    time.Now(),
			Body:         body,
		},
	)
}

func (c *Client) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.channel != nil {
		c.channel.Close()
	}
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}

func (c *Client) Channel() *amqp.Channel {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.channel
}
