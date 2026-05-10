-- +goose Up
-- +goose StatementBegin
CREATE TABLE categories (
    id            UUID        NOT NULL DEFAULT gen_random_uuid(),
    household_id  UUID        NOT NULL REFERENCES households(id) ON DELETE RESTRICT,
    parent_id     UUID,
    name          TEXT        NOT NULL,
    icon          TEXT        NOT NULL DEFAULT '',
    color         TEXT        NOT NULL DEFAULT '',
    created_by    UUID        NOT NULL REFERENCES users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ,
    deleted_by    UUID        REFERENCES users(id),
    PRIMARY KEY (id),
    CONSTRAINT categories_id_household_uq UNIQUE (id, household_id),
    CONSTRAINT categories_parent_household_fk FOREIGN KEY (parent_id, household_id)
        REFERENCES categories (id, household_id) ON DELETE RESTRICT,
    CHECK (length(name) BETWEEN 1 AND 100),
    CHECK (parent_id IS NULL OR parent_id <> id)
);

CREATE UNIQUE INDEX categories_household_parent_name_uq
    ON categories (household_id, parent_id, lower(name))
    WHERE deleted_at IS NULL AND parent_id IS NOT NULL;

CREATE UNIQUE INDEX categories_household_root_name_uq
    ON categories (household_id, lower(name))
    WHERE deleted_at IS NULL AND parent_id IS NULL;

CREATE INDEX categories_household_id_idx ON categories (household_id) WHERE deleted_at IS NULL;
CREATE INDEX categories_parent_id_idx ON categories (parent_id) WHERE deleted_at IS NULL;

CREATE TABLE categorization_rules (
    id              UUID        NOT NULL DEFAULT gen_random_uuid(),
    household_id    UUID        NOT NULL REFERENCES households(id) ON DELETE RESTRICT,
    match_field     TEXT        NOT NULL CHECK (match_field IN ('description','merchant')),
    match_pattern   TEXT        NOT NULL,
    category_id     UUID        NOT NULL,
    priority        INT         NOT NULL DEFAULT 100,
    created_by      UUID        NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    deleted_by      UUID        REFERENCES users(id),
    PRIMARY KEY (id),
    CONSTRAINT categorization_rules_id_household_uq UNIQUE (id, household_id),
    CONSTRAINT categorization_rules_category_household_fk FOREIGN KEY (category_id, household_id)
        REFERENCES categories (id, household_id) ON DELETE CASCADE,
    CHECK (length(match_pattern) BETWEEN 1 AND 500),
    CHECK (priority >= 0)
);

CREATE INDEX categorization_rules_household_priority_idx
    ON categorization_rules (household_id, priority)
    WHERE deleted_at IS NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS categorization_rules;
DROP TABLE IF EXISTS categories;
-- +goose StatementEnd
