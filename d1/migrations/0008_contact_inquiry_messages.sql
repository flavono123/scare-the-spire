-- 작은 우편함 threads: the replies of an inquiry, the inquirer's and the operator's, in time order. The
-- inquiry row keeps its first message, and admin_response/responded_at stay as the latest operator reply
-- (the mailbox dot and replies-seen read them). D1 only: Supabase is retired (mirror.enabled off), so no
-- outbox row is written for this table. The backfill turns today's single replies into the first message.
-- Generated from docs/supabase-exit/d1-schema/schema.src.sql by gen_schema.py: edit the source
-- and regenerate (check.py fails when they differ). Once applied to a remote database, never
-- change this file; add a new migration section to the source instead.

CREATE TABLE IF NOT EXISTS contact_inquiry_messages (
  id INTEGER PRIMARY KEY,
  -- No foreign key: a step 2 re-fill drops and re-creates contact_inquiries, which would cascade here.
  inquiry_id TEXT NOT NULL CHECK ((inquiry_id GLOB '????????-????-????-????-????????????' AND inquiry_id NOT GLOB '*[^0-9a-f-]*' AND length(replace(inquiry_id, '-', '')) = 32)),
  author TEXT NOT NULL CHECK (author IN ('user', 'admin')),
  message TEXT NOT NULL CHECK (length(message) BETWEEN 1 AND 8000 AND message = trim(message)),
  created_at TEXT NOT NULL CHECK ((substr(created_at, 1, 10) GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND substr(created_at, 11, 9) GLOB 'T[0-9][0-9]:[0-9][0-9]:[0-9][0-9]' AND substr(created_at, 20) GLOB '.[0-9][0-9][0-9][0-9][0-9][0-9]Z'))
) STRICT;
-- C3/C5a: one inquiry's thread in time order; C7 counts a user's recent replies through it.
CREATE INDEX IF NOT EXISTS contact_inquiry_messages_inquiry_created
  ON contact_inquiry_messages (inquiry_id, created_at, id);

INSERT INTO contact_inquiry_messages (inquiry_id, author, message, created_at)
SELECT id, 'admin', admin_response, responded_at FROM contact_inquiries
WHERE admin_response IS NOT NULL ORDER BY responded_at, id;
