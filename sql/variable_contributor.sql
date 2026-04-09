-- Run on Supabase (SQL editor or migration).
-- variable_contributor = true means voluntary contributor (no fixed monthly commitment).

ALTER TABLE members
ADD COLUMN IF NOT EXISTS variable_contributor boolean NOT NULL DEFAULT false;

-- Verify voluntary members:
-- SELECT name, variable_contributor, anonymous FROM members WHERE variable_contributor = true;
