-- +goose Up
-- +goose StatementBegin
CREATE TABLE budgets (
    id            UUID          NOT NULL DEFAULT gen_random_uuid(),
    household_id  UUID          NOT NULL REFERENCES households(id) ON DELETE RESTRICT,
    -- NULL category_id => "overall household" budget; otherwise scoped
    -- to one category. The (id, household_id) composite FK enforces
    -- same-household integrity for the categorical case.
    category_id   UUID,
    period        TEXT          NOT NULL DEFAULT 'monthly'
                  CHECK (period IN ('monthly')),
    amount        NUMERIC(18,2) NOT NULL CHECK (amount > 0),
    currency      TEXT          NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
    starts_on     DATE          NOT NULL DEFAULT (CURRENT_DATE),
    enabled       BOOLEAN       NOT NULL DEFAULT TRUE,
    name          TEXT          NOT NULL DEFAULT '',
    created_by    UUID          NOT NULL REFERENCES users(id),
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ,
    deleted_by    UUID          REFERENCES users(id),
    PRIMARY KEY (id),
    CONSTRAINT budgets_id_household_uq UNIQUE (id, household_id),
    CONSTRAINT budgets_category_household_fk
        FOREIGN KEY (category_id, household_id)
        REFERENCES categories (id, household_id)
        ON DELETE SET NULL (category_id)
);

CREATE INDEX budgets_household_enabled_idx
    ON budgets (household_id)
    WHERE deleted_at IS NULL AND enabled = TRUE;

CREATE TABLE budget_alerts (
    id             UUID        NOT NULL DEFAULT gen_random_uuid(),
    budget_id      UUID        NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    period_start   DATE        NOT NULL,
    threshold_pct  INT         NOT NULL CHECK (threshold_pct IN (50,80,100)),
    fired_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered      BOOLEAN     NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id),
    CONSTRAINT budget_alerts_uq UNIQUE (budget_id, period_start, threshold_pct)
);

CREATE INDEX budget_alerts_budget_idx ON budget_alerts (budget_id, period_start);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS budget_alerts;
DROP TABLE IF EXISTS budgets;
-- +goose StatementEnd
