import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Middleware to parse JSON
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Fieldly webhook endpoint
app.post('/webhook/fieldly', async (req, res) => {
  try {
    const payload = req.body;

    console.log('Received webhook payload:', JSON.stringify(payload, null, 2));

    // Validate payload structure
    if (!payload.date || !payload.transcription) {
      return res.status(400).json({ error: 'Invalid payload: missing required fields' });
    }

    // Store the transcription in Supabase
    const { data, error } = await supabase
      .from('transcriptions')
      .insert({
        date: payload.date,
        transcription: payload.transcription,
        transcriptions: payload.transcriptions || [],
        raw_payload: payload
      })
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: 'Failed to store transcription' });
    }

    console.log('Stored transcription:', data);
    res.status(200).json({ success: true, id: data[0]?.id });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Fieldly webhook listener running on port ${PORT}`);
  console.log(`Webhook endpoint: POST http://localhost:${PORT}/webhook/fieldly`);
});
