-- +goose Up
-- +goose StatementBegin
CREATE TABLE transactions (
    id                       UUID          NOT NULL DEFAULT gen_random_uuid(),
    household_id             UUID          NOT NULL REFERENCES households(id) ON DELETE RESTRICT,
    account_id               UUID          NOT NULL,
    type                     TEXT          NOT NULL CHECK (type IN ('expense','income','transfer','adjustment')),
    amount                   NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    currency                 TEXT          NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    occurred_at              TIMESTAMPTZ   NOT NULL,
    description              TEXT          NOT NULL DEFAULT '',
    merchant                 TEXT          NOT NULL DEFAULT '',
    category_id              UUID,
    category_source          TEXT          NOT NULL DEFAULT 'none'
                              CHECK (category_source IN ('manual','rule','import','system','none')),
    categorization_rule_id   UUID,
    source                   TEXT          NOT NULL DEFAULT 'manual'
                              CHECK (source IN ('manual','csv','bot')),
    external_id              TEXT,
    external_hash            TEXT,
    raw_payload              JSONB,
    transfer_id              UUID,
    idempotency_key          TEXT,
    created_by               UUID          NOT NULL REFERENCES users(id),
    updated_by               UUID          REFERENCES users(id),
    created_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at               TIMESTAMPTZ,
    deleted_by               UUID          REFERENCES users(id),
    PRIMARY KEY (id),
    CONSTRAINT transactions_account_household_fk
        FOREIGN KEY (account_id, household_id)
        REFERENCES accounts (id, household_id)
        ON DELETE RESTRICT,
    CONSTRAINT transactions_category_household_fk
        FOREIGN KEY (category_id, household_id)
        REFERENCES categories (id, household_id)
        ON DELETE SET NULL (category_id),
    CONSTRAINT transactions_rule_household_fk
        FOREIGN KEY (categorization_rule_id, household_id)
        REFERENCES categorization_rules (id, household_id)
        ON DELETE SET NULL (categorization_rule_id)
);

CREATE UNIQUE INDEX transactions_account_external_hash_uq
    ON transactions (account_id, external_hash)
    WHERE external_hash IS NOT NULL;

CREATE UNIQUE INDEX transactions_household_idempotency_uq
    ON transactions (household_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX transactions_transfer_id_idx
    ON transactions (transfer_id)
    WHERE transfer_id IS NOT NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS transactions;
-- +goose StatementEnd
