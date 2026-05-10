package producer

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/qazevent/<service_name>/pkg/rabbitmq"
)

type Producer struct {
	client     *rabbitmq.Client
	routingKey string
}

func New(client *rabbitmq.Client, routingKey string) *Producer {
	return &Producer{
		client:     client,
		routingKey: routingKey,
	}
}

func (p *Producer) Publish(ctx context.Context, msg any) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("marshal message: %w", err)
	}

	return p.client.Publish(ctx, p.routingKey, data)
}

func (p *Producer) Close() error {
	return p.client.Close()
}
