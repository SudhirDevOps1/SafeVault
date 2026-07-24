// SafeVault Zero-Knowledge Cloud Relay Worker
// 100% Open-Source & Self-Hostable on Cloudflare Workers (Free Tier)
//
// To deploy:
// 1. Install Wrangler: npm install -g wrangler
// 2. Login to Cloudflare: wrangler login
// 3. Create KV Namespace: wrangler kv:namespace create SAFEVAULT_KV
// 4. Publish: wrangler publish --name safevault-relay

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // Route: /channel/:id
    const match = path.match(/^\/channel\/([a-zA-Z0-9_-]+)$/);
    if (!match) {
      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const channelId = match[1];

    if (request.method === "POST") {
      try {
        const payload = await request.json();
        if (!payload.ciphertext || !payload.iv) {
          return new Response(JSON.stringify({ error: "Invalid Payload" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
        
        // Save encrypted data to Cloudflare KV. Auto-expires in 10 minutes (600 seconds) for security.
        await env.SAFEVAULT_KV.put(channelId, JSON.stringify(payload), { expirationTtl: 600 });
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    if (request.method === "GET") {
      try {
        const data = await env.SAFEVAULT_KV.get(channelId);
        if (!data) {
          return new Response(JSON.stringify({ error: "Channel not found or expired" }), {
            status: 404,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          });
        }
        return new Response(data, {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }
};
