DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE n.nspname = 'public'
  ) THEN
    RAISE EXCEPTION 'Une extension existe encore dans public';
  END IF;
END $$;