-- Convert new entries that came in before the webhook fix was deployed
-- These are entries from Dec 6 UTC (05:xx) that should be Dec 5 Central (23:xx)
-- For December (CST = UTC-6), we subtract 6 hours

UPDATE transcriptions
SET date = date - INTERVAL '6 hours'
WHERE date >= '2025-12-06 00:00:00+00'
  AND date < '2025-12-07 00:00:00+00';

-- Verify the fix
-- SELECT id, date, transcription FROM transcriptions ORDER BY date DESC LIMIT 10;
