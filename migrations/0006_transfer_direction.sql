-- +goose Up
-- +goose StatementBegin
ALTER TABLE transactions
    ADD COLUMN transfer_direction TEXT
    CHECK (transfer_direction IS NULL OR transfer_direction IN ('out','in'));

CREATE INDEX transactions_transfer_id_direction_idx
    ON transactions (transfer_id, transfer_direction)
    WHERE transfer_id IS NOT NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS transactions_transfer_id_direction_idx;
ALTER TABLE transactions DROP COLUMN IF EXISTS transfer_direction;
-- +goose StatementEnd
