-- Feedback entries table used by FeedbackManager

CREATE TABLE IF NOT EXISTS public.feedback_entries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  author_name text NOT NULL,
  author_role text NOT NULL DEFAULT 'STAFF',
  message text NOT NULL,
  tagged_assets text[] NOT NULL DEFAULT '{}',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_entries_created_at
ON public.feedback_entries (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedback_entries_is_read
ON public.feedback_entries (is_read);
