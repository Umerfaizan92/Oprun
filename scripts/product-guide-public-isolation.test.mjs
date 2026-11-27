// Public guide requests may carry an arbitrary client conversation ID, but that ID
// must never retrieve another caller's retained provider history. Exercises the real
// HTTP endpoint with a local mock provider and a throwaway database; no paid APIs.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startServer } from './test-server.mjs';

test('public guide ignores caller-selected history IDs while preserving explicit request context', { timeout: 60000 }, async () => {
  const seen = [];
  const provider = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
      res.writeHead(404);
      res.end();
      return;
    }
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      let body;
      try { body = JSON.parse(raw); } catch {
        res.writeHead(400);
        res.end();
        return;
      }
      seen.push(body);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        choices: [{
          message: { role: 'assistant', content: `Fixture reply ${seen.length}.` },
          finish_reason: 'stop'
        }]
      }));
    });
  });
  await new Promise((resolve, reject) => {
    provider.once('error', reject);
    provider.listen(0, '127.0.0.1', resolve);
  });
  let server;
  try {
    server = await startServer({
      FREE_AI_MODE: '0',
      AI_PROVIDER_BASE_URL: `http://127.0.0.1:${provider.address().port}/v1`,
      AI_PROVIDER_API_KEY: 'guide-fixture-key',
      AI_PROVIDER_MODEL: 'local-guide-isolation-model'
    });
    const sharedId = 'guessed-public-thread';
    const markerA = 'synthetic-guide-caller-a-marker-789314';
    const questionB = 'Explain the approval gate for a new quote.';
    const ask = (question, context = 'public') => server.call('POST', '/api/product-guide/answer', {
      // No session/visitor cookies: these are independent public callers sharing
      // an attacker-controlled conversation_id, not one authenticated session.
      body: { question, context, language: 'en', conversation_id: sharedId }
    });
    const assertProviderReply = (reply, index) => {
      assert.equal(reply.status, 200);
      assert.equal(reply.json?.ok, true);
      assert.equal(reply.json?.source, 'configured-ai-provider', 'local fallback must not mask a failed provider fixture');
      assert.equal(reply.json?.provider, 'compatible');
      assert.equal(reply.json?.model, 'local-guide-isolation-model');
      assert.equal(reply.json?.text, `Fixture reply ${index}.`);
      assert.equal(seen.length, index, 'exactly one configured-provider request per guide request');
    };

    assertProviderReply(await ask(`Remember this synthetic marker: ${markerA}`), 1);
    assert.match(JSON.stringify(seen[0].messages), new RegExp(markerA));

    assertProviderReply(await ask(questionB), 2);
    const secondMessages = JSON.stringify(seen[1].messages);
    assert.ok(secondMessages.includes(questionB), 'current question still reaches the provider');
    assert.ok(!secondMessages.includes(markerA), 'shared ID must not retrieve the first public caller history');
    assert.ok(!secondMessages.includes('Fixture reply 1.'), 'earlier assistant answer is not retained either');

    const explicitContext = 'synthetic-explicit-client-context-563821';
    const thirdQuestion = `Question: How do I review it? Relevant recent conversation context: ${explicitContext}`;
    assertProviderReply(await ask(thirdQuestion, 'public product guide'), 3);
    const thirdMessages = JSON.stringify(seen[2].messages);
    assert.ok(thirdMessages.includes(thirdQuestion), 'client-provided recent context is preserved explicitly');
    assert.ok(thirdMessages.includes('Context: public product guide'), 'ordinary product context remains compatible');
    assert.ok(thirdMessages.includes('Reply language: en'), 'language handling remains intact');
    assert.ok(!thirdMessages.includes(markerA), 'explicit context does not reactivate earlier hidden history');
    assert.ok(!thirdMessages.includes(questionB), 'second caller request was not remembered on the server');
  } finally {
    try { if (server) await server.stop(); }
    finally { await new Promise((resolve) => provider.close(resolve)); }
  }
});
