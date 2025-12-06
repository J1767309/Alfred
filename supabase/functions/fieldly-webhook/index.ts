import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    })
  }

  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    )
  }

  try {
    const payload = await req.json()

    console.log("Received webhook payload:", JSON.stringify(payload, null, 2))

    // Validate payload structure
    if (!payload.date || !payload.transcription) {
      return new Response(
        JSON.stringify({ error: "Invalid payload: missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    // Create Supabase client using environment variables
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Store the transcription in Supabase
    const { data, error } = await supabase
      .from("transcriptions")
      .insert({
        date: payload.date,
        transcription: payload.transcription,
        transcriptions: payload.transcriptions || [],
        raw_payload: payload,
      })
      .select()

    if (error) {
      console.error("Supabase insert error:", error)
      return new Response(
        JSON.stringify({ error: "Failed to store transcription" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      )
    }

    console.log("Stored transcription:", data)

    return new Response(
      JSON.stringify({ success: true, id: data[0]?.id }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("Webhook error:", err)
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
})
