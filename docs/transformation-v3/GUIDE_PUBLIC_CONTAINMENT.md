# Public guide Stage A containment — candidate only
Base: 7b3d0946c7aa1e442087fa4f588680c0c275513c. Branch: codex/guide-public-containment.
No production merge/deploy; tests pending hosted Node22 CI and independent review.

Runtime change: src/server.js public /api/product-guide/answer passes conversation_id:null to generateAiText. A client-supplied identifier no longer selects retained server memory. Schema accepts the old optional ID for compatibility, but ignores it for server retention. Explicit client question/context/language remain unchanged. Operational AI threads and other routes unchanged.

Regression: scripts/product-guide-public-isolation.test.mjs starts the actual server with isolated DB/secrets and a loopback compatible-AI mock. Two anonymous requests share one chosen ID; the second must exclude the first unique marker and assistant response. A third request must preserve explicit client recent context and language while excluding earlier implicit history. Every response must say configured-ai-provider/compatible with the exact fixture model/text, so local fallback cannot produce false PASS. Old runtime should fail second-request isolation assertion.

Run: node --test scripts/product-guide-public-isolation.test.mjs
Then existing ai-memory-isolation, tenant/RBAC and full npm test via hosted CI.
Manifest update and PR are owned by root after independent source review.

Scope limits: frontend clear/reset and cancellation races, authenticated workspace history binding, no-store/privacy handling and optional anonymous visitor capabilities are NOT fixed. Existing workspace guide callers currently also use this public endpoint: they retain explicitly supplied browser context, but no hidden server history through this route. This is a narrow containment change, not full guide ownership remediation or a claim that stored browser text is deleted. Old server Map entries are not explicitly erased; this route can no longer address them and they expire normally. No paid provider contacted.

Status: IMPLEMENTED CANDIDATE / TESTS NOT RUN / NOT RELEASED.
