export default {
  async fetch(request, env) {
    // 1. Handle CORS preflight requests (so your browser doesn't block it)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Accept",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Only allow POST requests
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // 2. Retrieve your secure API key from Cloudflare Variables
    const OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;

    if (!OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: { message: "API key not configured in proxy" } }), { 
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    try {
      // Read the incoming request from Klyro UI
      const body = await request.text();
      
      // 3. Forward the request to OpenRouter securely
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://klyro-ai-assistant.web.app",
          "X-Title": "Klyro AI"
        },
        body: body
      });

      // 4. Stream the response directly back to Klyro, adding CORS headers
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set("Access-Control-Allow-Origin", "*");

      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: { message: err.message } }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
  }
};
