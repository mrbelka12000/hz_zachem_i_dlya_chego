-- +goose Up
-- +goose StatementBegin
-- categorization_rules was created in migration 0003 with a single
-- (match_field, match_pattern) shape, but no service code ever wrote
-- to it. Reshape it now into "name + patterns array" so one rule can
-- cover "Restaurant" OR "Cafe" OR "Pizza" -> Food, matching against
-- both merchant and description.
ALTER TABLE categorization_rules
    DROP COLUMN match_field,
    DROP COLUMN match_pattern,
    ADD COLUMN name TEXT NOT NULL DEFAULT '',
    ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN match_patterns TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE categorization_rules
    ALTER COLUMN match_patterns DROP DEFAULT,
    ADD CONSTRAINT categorization_rules_patterns_chk
        CHECK (cardinality(match_patterns) > 0);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE categorization_rules
    DROP CONSTRAINT IF EXISTS categorization_rules_patterns_chk,
    DROP COLUMN match_patterns,
    DROP COLUMN enabled,
    DROP COLUMN name,
    ADD COLUMN match_field TEXT NOT NULL DEFAULT 'merchant'
        CHECK (match_field IN ('description','merchant')),
    ADD COLUMN match_pattern TEXT NOT NULL DEFAULT '';

ALTER TABLE categorization_rules
    ALTER COLUMN match_field DROP DEFAULT,
    ALTER COLUMN match_pattern DROP DEFAULT,
    ADD CONSTRAINT categorization_rules_match_pattern_length_chk
        CHECK (length(match_pattern) BETWEEN 1 AND 500);
-- +goose StatementEnd
