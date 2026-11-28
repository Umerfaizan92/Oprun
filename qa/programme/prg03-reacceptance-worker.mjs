// Worker for the PRG-03 independent re-acceptance suite: one OS process, its own SQLite connection, real HTTP to a
// loopback Stripe stand-in. Input arrives as JSON in PRG03_WORKER. Prints one JSON line with the outcome.
import crypto from 'node:crypto';
import { createDb } from '../../src/db.js';
import { installPayments } from '../../src/payments.js';
import { createFinance } from '../../src/finance/service.js';

const input = JSON.parse(process.env.PRG03_WORKER);
const db = createDb(input.file);
const routes = new Map();
const app = Object.fromEntries(['get', 'post', 'put', 'delete', 'patch'].map((m) => [m, (p, ...h) => routes.set(m + ' ' + p, h.at(-1))]));
const payments = installPayments(app, { db, env: { STRIPE_API_BASE_URL: input.provider }, runtime: { decryptBundle: (v) => ({ v }) }, requireSaasUser() {}, requireSaasRole: () => () => {}, saasAudit() {}, financeRoles: ['owner'], syncJobFinance() {} });
const finance = createFinance({ db, payments, engineRef: { current: { startRun: () => ({ id: crypto.randomUUID(), promise: Promise.resolve() }) } } });
const out = (value) => { process.stdout.write(JSON.stringify(value) + '\n'); };
try {
  if (input.action === 'execute') {
    const r = await finance.executeRefund(input.org, { refund_id: input.refund }, input.approver);
    out({ ok: true, summary: r.summary });
  } else if (input.action === 'webhook') {
    const rawBody = JSON.stringify(input.event), ts = Math.floor(Date.now() / 1000);
    const sig = crypto.createHmac('sha256', input.secret).update(`${ts}.${rawBody}`).digest('hex');
    const res = { statusCode: 200, status(c) { this.statusCode = c; return this; }, json(v) { this.value = v; return this; } };
    await routes.get('post /api/webhooks/payments/stripe/:orgId')({ params: { orgId: input.org }, body: input.event, rawBody, get: () => `t=${ts},v1=${sig}` }, res);
    out({ ok: res.statusCode === 200, status: res.statusCode, value: res.value });
  } else if (input.action === 'reconcile') {
    out({ ok: true, value: await finance.reconcileStripeRefund(input.org, input.refund, input.approver, input.body || {}) });
  }
} catch (error) {
  out({ ok: false, error: error.message, code: error.code ?? null, permanent: Boolean(error.permanent) });
} finally { db.close(); }
