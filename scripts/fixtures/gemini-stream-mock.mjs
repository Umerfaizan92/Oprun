// Test-only preload (NODE_OPTIONS=--import). Replaces fetch for the Gemini streaming TTS URL with a slow synthetic
// SSE stream (about 8KB of base64 audio per event, like real PCM chunks): one audio event at once, a second after GEMINI_MOCK_GAP_MS. Every other request uses the real fetch.
const realFetch = globalThis.fetch;
const gap = Number(process.env.GEMINI_MOCK_GAP_MS || 1500);
globalThis.fetch = async (url, options) => {
  if (!String(url).startsWith('https://generativelanguage.googleapis.com/') || !String(url).includes('streamGenerateContent')) return realFetch(url, options);
  const event = (n) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { data: Buffer.alloc(6000, n).toString('base64') } }] } }] })}\n\n`;
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(event(1)));
      await new Promise((r) => setTimeout(r, gap));
      controller.enqueue(encoder.encode(event(2)));
      controller.close();
    }
  });
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
};
