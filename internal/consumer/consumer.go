package consumer

import (
	"context"
	"fmt"

	"github.com/qazevent/hz_zachem/pkg/rabbitmq"
	amqp "github.com/rabbitmq/amqp091-go"
)

type Handler func(ctx context.Context, msg []byte) error

type Consumer struct {
	client *rabbitmq.Client
	queue  string
}

func New(client *rabbitmq.Client, queue string) *Consumer {
	return &Consumer{
		client: client,
		queue:  queue,
	}
}

func (c *Consumer) Consume(ctx context.Context, handler Handler) error {
	msgs, err := c.client.Channel().Consume(
		c.queue,
		"",    // consumer tag
		false, // auto-ack
		false, // exclusive
		false, // no-local
		false, // no-wait
		nil,
	)
	if err != nil {
		return fmt.Errorf("consume: %w", err)
	}

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case msg, ok := <-msgs:
			if !ok {
				return fmt.Errorf("channel closed")
			}
			if err := c.processMessage(ctx, msg, handler); err != nil {
				_ = msg.Nack(false, true)
				continue
			}
			_ = msg.Ack(false)
		}
	}
}

func (c *Consumer) processMessage(ctx context.Context, msg amqp.Delivery, handler Handler) error {
	return handler(ctx, msg.Body)
}
