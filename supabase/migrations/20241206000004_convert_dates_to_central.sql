-- Convert existing UTC timestamps to Central Time
-- This shifts all dates back by 6 hours (CST offset)
-- So 2025-12-06 05:08:08+00 (UTC) becomes 2025-12-05 23:08:08+00 (Central Time stored as UTC)

-- For December (CST = UTC-6), we subtract 6 hours
UPDATE transcriptions
SET date = date - INTERVAL '6 hours'
WHERE date IS NOT NULL;

-- Verify: dates should now show as Dec 5 instead of Dec 6
-- SELECT id, date, transcription FROM transcriptions ORDER BY date DESC LIMIT 10;
