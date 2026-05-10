-- +goose Up
-- +goose StatementBegin
CREATE INDEX transactions_household_occurred_at_idx
    ON transactions (household_id, occurred_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX transactions_account_occurred_at_idx
    ON transactions (account_id, occurred_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX transactions_category_occurred_at_idx
    ON transactions (category_id, occurred_at DESC)
    WHERE deleted_at IS NULL AND category_id IS NOT NULL;

CREATE INDEX transactions_household_uncategorized_idx
    ON transactions (household_id, occurred_at DESC)
    WHERE deleted_at IS NULL AND category_id IS NULL;

CREATE INDEX transactions_household_type_occurred_at_idx
    ON transactions (household_id, type, occurred_at DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX transactions_household_merchant_idx
    ON transactions (household_id, lower(merchant))
    WHERE deleted_at IS NULL AND merchant <> '';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS transactions_household_merchant_idx;
DROP INDEX IF EXISTS transactions_household_type_occurred_at_idx;
DROP INDEX IF EXISTS transactions_household_uncategorized_idx;
DROP INDEX IF EXISTS transactions_category_occurred_at_idx;
DROP INDEX IF EXISTS transactions_account_occurred_at_idx;
DROP INDEX IF EXISTS transactions_household_occurred_at_idx;
-- +goose StatementEnd
