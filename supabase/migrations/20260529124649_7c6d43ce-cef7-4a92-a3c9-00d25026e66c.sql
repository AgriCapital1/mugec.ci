-- Enable pg_cron + pg_net (idempotent)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule existing jobs with the same name (idempotent re-run safety)
DO $$
DECLARE jid bigint;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname IN (
    'mugec-process-notification-queue',
    'mugec-enqueue-cotisation-reminders'
  ) LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

-- Worker Brevo : draine la file toutes les 5 minutes
SELECT cron.schedule(
  'mugec-process-notification-queue',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--4c7df4a3-ce6f-4595-bdd6-fe18d151194f.lovable.app/api/public/hooks/process-notification-queue',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqZ3BpcHhtYWZ6eHFxa3dhaXdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMjAzMjUsImV4cCI6MjA5NDc5NjMyNX0.R0aa8YP5HTO_BPlt0OE9GdC5jzVffs3qzF3Tn8TIFGk'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Enqueue rappels cotisations : tous les jours à 08:00 UTC
SELECT cron.schedule(
  'mugec-enqueue-cotisation-reminders',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--4c7df4a3-ce6f-4595-bdd6-fe18d151194f.lovable.app/api/public/hooks/enqueue-cotisation-reminders',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqZ3BpcHhtYWZ6eHFxa3dhaXdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMjAzMjUsImV4cCI6MjA5NDc5NjMyNX0.R0aa8YP5HTO_BPlt0OE9GdC5jzVffs3qzF3Tn8TIFGk'
    ),
    body := '{}'::jsonb
  );
  $$
);