-- Mark Josphine Kpai as anonymous on the public dashboard (name hidden; branch can still show).
-- Run in Supabase SQL editor.

UPDATE members
SET anonymous = true
WHERE name = 'Josphine Kpai';

-- Verify:
-- SELECT name, anonymous, branch FROM members WHERE name = 'Josphine Kpai';
