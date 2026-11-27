# Security patch review — guide reset and caller ownership
27 November 2026. Source pinned to `7b3d0946c7aa1e442087fa4f588680c0c275513c`.
**Reviewable proposal only; runtime not modified, tests not executed.**
Execution environment unavailable. Owner authorizes isolated implementation, not production changes. Root supervisor integrates this scope; independent reviewer must verify implementation before acceptance. This document supplements the existing task register, not a replacement backlog.

## Source findings independently confirmed
| Finding | Evidence | Impact / limit |
|---|---|---|
| Local clear preserves conversation identity | `saas/product-guide.js:197–200` deletes memory key only; ID is a separate localStorage item | Subsequent call can resume hidden provider history after UI says fresh |
| Public fresh button clears presentation only | `saas/intro.js:384` resets log/language but never calls guide memory.clear | Both transcript memory and server conversation can persist |
| Public request uses caller-selected shared key | `src/server.js:2835–2840` calls generateAiText with `guide:` + body.conversation_id, no ownership check | Prefix prevents collision with operational threads, not another guide caller. No live exploit attempted |
| Workspace guide uses same anonymous endpoint | `saas/product-guide.js:208` | Browser key includes org/user, but client conventions are not server authorization |
| In-flight reset can repaint/retry | `saas/intro.js:344–384`: catch invokes answerAsync again after errors and always renders/speaks; no reset generation fence | Abort/reset may create another old request; a stale response may appear after fresh start |
| Current response can save under changed identity | `product-guide.js:answerAsync` awaits then remember(context,...) recomputes current memoryKey | Workspace switch/signout while awaiting requires start-scope fence |
| Shim keeps history | `src/ai-provider-shim.js:73–77,138–150`: Map with six-hour TTL and per-ID history | Clearing browser text does not erase retained server entries |

`scripts/ai-memory-isolation.test.mjs` tests shim namespace separation; it does not exercise endpoint ownership or reset. Its historical PASS must not close these findings. Existing membership middleware `server.js:2250–2271` validates selected org membership, expiry, active account/membership and staff policy.

## Recommended staged implementation

### Stage A — contain and fix reset (smallest change)
1. Make the public product guide **stateless on the server**: never supply body.conversation_id to generateAiText. Use `conversation_id:null` for public guide calls. The browser already passes explicitly selected memory in its question. This removes the public cross-caller hidden-history path without new cookies or identity infrastructure.
2. Do not silently claim persistent public conversation binding is implemented: this is intentional stateless public history. If server-persistent anonymous history is retained as a product requirement, implement Stage C instead before enabling it.
3. Workspace product guidance moves to `POST /api/saas/product-guide/answer` behind existing requireSaasUser and entitlement/staff controls. No fallback from a failed workspace authentication to the public endpoint.
4. Existing public route remains compatible for genuinely public product questions. Reject context requesting workspace treatment with a clear401 or400; a string context is never authority to read records.
5. During rollout old workspace clients may still hit public route: either ship both frontend/backend together and force asset version refresh, or offer temporary public **stateless product-only** guidance for old clients. Never retain the old caller-selected shared memory key for compatibility.

Exact minimal route change:
```diff
- conversation_id:parsed.data.conversation_id?'guide:'+parsed.data.conversation_id:null,
+ conversation_id:null,
```
This is only public-endpoint containment, not complete Stage B workspace history.

### Stage B — authenticate and bind workspace conversation history
- Validate body with bounded question/language/context and optional UUID conversation ID. Generate random UUID on server if absent; return it. Do not accept arbitrary-length identifiers as authority.
- Obtain organisation_id, user_id and session_id **only** from validated req.saas. Never use body identity, typed prompt IDs, localStorage or X-Organisation-Id without existing membership validation.
- Derive an unambiguous internal key from a length-delimited/canonical JSON tuple:
  `["guide-v2","workspace",organisation_id,user_id,session_id,clientConversationUUID]`.
  Use SHA256 of this canonical tuple for bounded opaque Map keys, prefixed `guide-v2:`. Hashing does not confer authorization; validated server identity does. HMAC is optional defense-in-depth using an existing server secret; do not invent/deploy a new secret without environment setup approval.
- New `guide-v2` prefix intentionally never resumes old unowned guide histories.
- Same UUID in two tenants, users or login sessions must produce different server keys. Revoked session must fail before provider invocation. Workspace switch must use current authenticated selected-org membership. Use existing request helper or explicitly selected org header as established by app; server still validates membership.
- Keep operational workspace AI thread APIs unchanged. Share parsing/generation handler without weakening auth or duplicating model/provider logic.
- Apply no-store to guidance and reset responses. Preserve provider rate limits, request bounds, local multilingual fallback and cost restrictions.
- Do not provide a server-wide “delete conversation by ID” endpoint. Reset of a bound server entry, if exposed, derives exactly the caller-owned key after auth. Concurrency/generation fencing is still mandatory.
- Existing requireSaasUser renews sessions and synchronizes subscription state; do not call it speculatively from public routes as “optional auth.”

### Stage C — only if persistent anonymous server memory is required
Use a separate first-party visitor capability, not IP, User-Agent, fingerprint, raw client conversation ID or unsigned cookie as ownership:
- Server generates32 cryptographically random bytes. Sign a versioned token containing nonce + issued/expiry times using an existing server session key with purpose-specific HMAC context. Validate signature in constant time, bounded lengths/version and expiration before using it.
- Production cookie: `__Host-oprun-guide`; Secure; HttpOnly; SameSite=Strict; Path=/; no Domain; bounded TTL no longer than the6h history window. Local HTTP test fixture uses a clearly separate development cookie name and must not weaken production cookie attributes.
- Missing/invalid/expired cookie issues a new capability with fresh isolated history; never trusts an unsigned attacker-chosen nonce. If cookies are unavailable, serve stateless guidance.
- Public persistent key is derived from validated visitor nonce + client UUID + `guide-v2-public`. Authenticated workspace keys remain separate; never promote public history into workspace context or treat visitor identity as an account.
- A copied valid capability is a bearer credential; do not claim protection if an attacker possesses another caller's cookie. Tokens/IDs must never be logged or placed in URLs.
- Verify current cross-origin/CSRF policy; reject cross-site unsafe requests before provider calls. SameSite alone is not a complete authorization mechanism.
- This adds cookie/retention behavior: update privacy/cookie description and consent treatment as required. Stage A avoids this additional persistence and is preferred unless product needs it.

## Frontend reset contract (all stages)
Replace clearMemory's single removeItem with one atomic logical reset of the current scope:
1. Snapshot memory scope; increment an in-memory generation counter for it.
2. Abort in-flight guide requests for that scope, stop pending narration/capture and cancel delayed voice-submit callbacks.
3. Remove transcript and separate conversation-ID key; create a new cryptographically random UUID for the next conversation. Never use Math.random or Date.now as an ownership/security token. Browser UUID is correlation only; authorization remains server-side.
4. Maintain an in-memory epoch/ID when localStorage is unavailable, so clear still works.
5. Return reset generation; callers use it to guard display. Public fresh button calls memory.clear('public'); workspace clear calls memory.clear('workspace').
6. For answerAsync snapshot scope, generation, conversation ID and authenticated workspace/user at request start. Check all immediately before saving memory or exposing a result. If changed, throw a dedicated cancellation/stale-result error with AbortError-compatible semantics.
7. Do not remember or return fallback content after cancellation. Public intro ask must detect AbortError/stale generation before its catch retry, before final DOM updates and before speak. Do not interpret cancellation as provider outage.
8. Clear should also reset lastTopic, pending placeholders and language state consistently. Retain input text only if product explicitly specifies it; never retain an old hidden provider request.
9. Handle clear in another tab with storage events (or BroadcastChannel), invalidating in-flight requests for the old conversation; logout/organisation switch invalidates the same scope.
10. Cache bust changed frontend asset references through existing build/version mechanism; update generated assets/manifest using normal commands once runtime exists.

Suggested precise affected files:
- `saas/product-guide.js`: memory reset, generation/controller bookkeeping, request endpoint selection and stale-result guards.
- `saas/intro.js`: fresh-conversation handler plus ask cancellation guard (both try and catch paths).
- `saas/ai-operations.js`: retain existing sessionRun and answerController guards; align message/semantics with actual reset.
- `src/server.js`: public stateless containment and protected handler registration; auth/principal key helper in a small module where practical.
- `src/ai-provider-shim.js`: optional owned reset method only if retention deletion is required; otherwise old entries expire normally. Do not advertise “all provider data erased” from browser clear.
- Actual version/build/manifest references determined from current tree at implementation time.

## Meaningful regression matrix (no paid providers)
Use a local mock provider capturing received messages and throwaway server/database fixtures. Never real business data.
| Case | Required assertion |
|---|---|
| Two public clients send identical conversation_id | Neither provider request includes the other's earlier unique marker; Stage A has no hidden retained history |
| TenantA versusB same UUID | Unique markerA absent fromB provider request |
| Same tenant, different users same UUID | No shared history |
| Same user changes tenant/session | New isolated history; revoked/expired session is401 before provider call |
| Forged X-Organisation-Id |403, provider call count unchanged |
| Public asks context=workspace | Cannot obtain authenticated guide treatment/history |
| Workspace reset then follow-up | Old marker absent from explicit browser context and hidden server history; new correlation ID |
| Clear while provider deferred | After release, response neither repaints nor saves nor speaks nor triggers retry |
| Provider fails after reset | No fallback save/retry for pre-reset generation |
| Workspace switches while deferred | Result not written under new org/user scope |
| LocalStorage denied | In-memory reset/generation still works |
| Cross-tab clear | Pending response invalidated in other tab |
| Public cookie missing/invalid/expired if StageC | Fresh isolated context; stateless fallback if blocked; signatures/expiry enforced |
| Cookie attributes if StageC | Secure/HttpOnly/SameSite/Path/noDomain in production; Set-Cookie append does not overwrite auth cookie |
| Cold rollout with old guide IDs | New namespace prevents prior unowned history reuse |
| Unicode/long/invalid IDs | Bounded validation, no ambiguous key collision, no500 |
| Rate limit and no-store | Existing rate limit preserved, no sensitive cacheable guidance |
| Provider outage | Correct localized fallback remains available unless request was cancelled |

Use jsdom/browser tests for UI races with controlled promises, not static source assertions. Use same-endpoint HTTP tests for ownership, not just direct shim calls. Mock provider assertions inspect actual outbound messages so regressions fail on old code.

## Verification and next action
No tests executed in this unavailable environment; no application patch committed. This proposal has source review only. Root must:
1. Record/assign the implementation task through existing memory CLI once execution returns.
2. Choose StageA stateless public + StageB workspace binding; only StageC if persistent anonymous history is explicitly required.
3. Implement and run focused failing-then-passing regression tests on Node22.
4. Independent reviewer inspects auth, session/workspace switches and cancellation races.
5. Run relevant tenant/RBAC/guide/voice suites, full npm test and browser acceptance; do not mark done from build alone.
6. Preserve staged evidence and request separate production release approval only after verified candidate exists.

Do not change production configuration, send customer messages, call funded providers, rotate credentials, delete data or assert breach/perfect security.
