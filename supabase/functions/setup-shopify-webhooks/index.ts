import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const shopifyDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
    const shopifyToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    if (!shopifyDomain || !shopifyToken || !supabaseUrl) {
      throw new Error('Missing required environment variables');
    }

    const webhookUrl = `${supabaseUrl}/functions/v1/shopify-webhook`;
    
    const webhookTopics = [
      'ORDERS_CREATE',
      'ORDERS_UPDATED',
      'ORDERS_FULFILLED',
      'ORDERS_CANCELLED',
    ];

    const results = [];

    for (const topic of webhookTopics) {
      console.log(`Creating webhook for ${topic}...`);

      const mutation = `
        mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
          webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
            webhookSubscription {
              id
              topic
              endpoint {
                __typename
                ... on WebhookHttpEndpoint {
                  callbackUrl
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const variables = {
        topic: topic,
        webhookSubscription: {
          callbackUrl: webhookUrl,
          format: 'JSON',
        },
      };

      const response = await fetch(
        `https://${shopifyDomain}/admin/api/2024-01/graphql.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': shopifyToken,
          },
          body: JSON.stringify({ query: mutation, variables }),
        }
      );

      const result = await response.json();
      
      if (result.data?.webhookSubscriptionCreate?.userErrors?.length > 0) {
        console.error(`Errors for ${topic}:`, result.data.webhookSubscriptionCreate.userErrors);
        results.push({
          topic,
          success: false,
          errors: result.data.webhookSubscriptionCreate.userErrors,
        });
      } else if (result.data?.webhookSubscriptionCreate?.webhookSubscription) {
        console.log(`✓ Successfully created webhook for ${topic}`);
        results.push({
          topic,
          success: true,
          webhook: result.data.webhookSubscriptionCreate.webhookSubscription,
        });
      } else {
        console.error(`Unexpected response for ${topic}:`, result);
        results.push({
          topic,
          success: false,
          error: 'Unexpected response format',
          details: result,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    return new Response(
      JSON.stringify({
        message: `Webhook setup complete: ${successCount}/${webhookTopics.length} successful`,
        webhookUrl,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Setup error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
