-- +goose Up
-- +goose StatementBegin
CREATE TABLE accounts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id      UUID          NOT NULL REFERENCES households(id) ON DELETE RESTRICT,
    name              TEXT          NOT NULL,
    type              TEXT          NOT NULL CHECK (type IN ('cash','card','bank','other')),
    currency          TEXT          NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    initial_balance   NUMERIC(18,2) NOT NULL DEFAULT 0,
    status            TEXT          NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
    created_by        UUID          NOT NULL REFERENCES users(id),
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ,
    deleted_by        UUID          REFERENCES users(id),
    CONSTRAINT accounts_id_household_uq UNIQUE (id, household_id),
    CHECK (length(name) BETWEEN 1 AND 100)
);

CREATE UNIQUE INDEX accounts_household_name_uq
    ON accounts (household_id, lower(name))
    WHERE deleted_at IS NULL;

CREATE INDEX accounts_household_id_idx ON accounts (household_id) WHERE deleted_at IS NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS accounts;
-- +goose StatementEnd
