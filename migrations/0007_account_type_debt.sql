-- +goose Up
-- +goose StatementBegin
ALTER TABLE accounts
    DROP CONSTRAINT accounts_type_check,
    ADD CONSTRAINT accounts_type_check CHECK (type IN ('cash','card','bank','other','debt'));
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE accounts
    DROP CONSTRAINT accounts_type_check,
    ADD CONSTRAINT accounts_type_check CHECK (type IN ('cash','card','bank','other'));
-- +goose StatementEnd
