-- +goose Up
-- +goose StatementBegin
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE households (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT        NOT NULL,
    base_currency   TEXT        NOT NULL DEFAULT 'KZT',
    timezone        TEXT        NOT NULL DEFAULT 'Asia/Almaty',
    created_by      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    deleted_by      UUID,
    CHECK (length(name) BETWEEN 1 AND 200),
    CHECK (base_currency ~ '^[A-Z]{3}$'),
    CHECK (length(timezone) > 0)
);

CREATE TABLE users (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email             TEXT        NOT NULL,
    password_hash     TEXT        NOT NULL,
    telegram_user_id  BIGINT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ,
    deleted_by        UUID,
    CHECK (length(email) BETWEEN 3 AND 320)
);

CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX users_telegram_user_id_uq ON users (telegram_user_id)
    WHERE telegram_user_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE users
    ADD CONSTRAINT users_deleted_by_fk FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE households
    ADD CONSTRAINT households_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    ADD CONSTRAINT households_deleted_by_fk FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE household_members (
    user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    household_id  UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    role          TEXT        NOT NULL CHECK (role IN ('owner','admin','member')),
    joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, household_id)
);

CREATE INDEX household_members_household_id_idx ON household_members (household_id);

CREATE TABLE household_invites (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id  UUID        NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    code          TEXT        NOT NULL UNIQUE,
    created_by    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    max_uses      INT         NOT NULL DEFAULT 1,
    used_count    INT         NOT NULL DEFAULT 0,
    expires_at    TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (max_uses > 0),
    CHECK (used_count >= 0),
    CHECK (used_count <= max_uses),
    CHECK (expires_at > created_at)
);

CREATE TABLE refresh_tokens (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash    TEXT        NOT NULL UNIQUE,
    expires_at    TIMESTAMPTZ NOT NULL,
    revoked_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX refresh_tokens_user_id_idx ON refresh_tokens (user_id) WHERE revoked_at IS NULL;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS household_invites;
DROP TABLE IF EXISTS household_members;
ALTER TABLE households DROP CONSTRAINT IF EXISTS households_created_by_fk;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS households;
-- +goose StatementEnd
