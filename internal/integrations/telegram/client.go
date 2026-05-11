// Package telegram is a minimal client around the Bot API for the
// budget-alert use case. It deliberately covers a single endpoint —
// sendMessage — to keep the dependency surface small. Empty bot
// token => the client logs to stderr and returns nil so callers
// don't have to special-case "telegram disabled".
package telegram

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

const sendMessagePath = "/bot%s/sendMessage"

type Client struct {
	apiBase  string
	botToken string
	http     *http.Client
}

func New(botToken string) *Client {
	return &Client{
		apiBase:  "https://api.telegram.org",
		botToken: botToken,
		http:     &http.Client{Timeout: 10 * time.Second},
	}
}

// Enabled reports whether the client will actually call the Bot API.
// When false, SendMessage logs the payload and returns nil.
func (c *Client) Enabled() bool { return c.botToken != "" }

// SendMessage delivers `text` to the chat identified by chatID.
// Returns an error only when the bot is configured AND the API call
// fails; "telegram disabled" is not an error.
func (c *Client) SendMessage(ctx context.Context, chatID int64, text string) error {
	if !c.Enabled() {
		log.Printf("telegram: notification (no bot token, skipping send) chat_id=%d text=%q", chatID, text)
		return nil
	}

	body, err := json.Marshal(map[string]any{
		"chat_id":                  chatID,
		"text":                     text,
		"disable_web_page_preview": true,
	})
	if err != nil {
		return fmt.Errorf("marshal: %w", err)
	}

	url := c.apiBase + fmt.Sprintf(sendMessagePath, c.botToken)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("send: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode/100 != 2 {
		buf, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
		return fmt.Errorf("telegram api: %s: %s", resp.Status, string(buf))
	}
	return nil
}
