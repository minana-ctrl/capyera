import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("=== Webhook Received ===");
    console.log("Method:", req.method);
    console.log("Headers:", Object.fromEntries(req.headers));
    
    const body = await req.json();
    console.log("Body:", JSON.stringify(body, null, 2));
    
    // Mock response - acknowledge receipt
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Webhook received successfully",
        received_at: new Date().toISOString(),
        data: body
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
