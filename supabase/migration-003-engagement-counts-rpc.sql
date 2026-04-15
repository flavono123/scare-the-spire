-- Migration 003: Server-side engagement count aggregation
-- Run this in Supabase Dashboard > SQL Editor
-- Replaces client-side full table scan with efficient GROUP BY

CREATE OR REPLACE FUNCTION get_engagement_counts(p_env text)
RETURNS TABLE(story_id text, like_count bigint, comment_count bigint)
AS $$
  SELECT
    COALESCE(l.story_id, c.story_id) AS story_id,
    COALESCE(l.cnt, 0) AS like_count,
    COALESCE(c.cnt, 0) AS comment_count
  FROM
    (SELECT story_id, COUNT(*) AS cnt FROM likes WHERE env = p_env GROUP BY story_id) l
  FULL OUTER JOIN
    (SELECT story_id, COUNT(*) AS cnt FROM comments WHERE env = p_env GROUP BY story_id) c
  ON l.story_id = c.story_id;
$$ LANGUAGE sql STABLE;
