-- Restore original UTC timestamps from raw_payload
-- The previous migration incorrectly shifted dates by 6 hours
-- raw_payload contains the original Fieldly data with correct UTC timestamps

-- First, let's see what we're working with (run this SELECT first to verify)
-- SELECT id, date, raw_payload->>'date' as original_date
-- FROM transcriptions
-- ORDER BY created_at DESC LIMIT 10;

-- Restore the original UTC timestamps from raw_payload
-- The raw_payload->>'date' field contains the original ISO8601 UTC timestamp from Fieldly
UPDATE transcriptions
SET date = (raw_payload->>'date')::timestamptz
WHERE raw_payload IS NOT NULL
  AND raw_payload->>'date' IS NOT NULL;

-- Verify the fix worked (uncomment to run)
-- SELECT id, date, raw_payload->>'date' as original_date
-- FROM transcriptions
-- ORDER BY created_at DESC LIMIT 10;
