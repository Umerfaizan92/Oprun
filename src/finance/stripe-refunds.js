import { ledgerFromStripeUnits, stripeUnitsOrNull } from '../payment-precision.js';

export function stripeRefundLedger(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS fin_stripe_refund_attempts (
      organisation_id TEXT NOT NULL, refund_id TEXT NOT NULL, payment_id TEXT NOT NULL,
      account_binding TEXT NOT NULL, approver TEXT, started_at TEXT NOT NULL, receipt_json TEXT,
      PRIMARY KEY (organisation_id, refund_id)
    );
    CREATE TABLE IF NOT EXISTS fin_stripe_refund_totals (
      organisation_id TEXT NOT NULL, payment_id TEXT NOT NULL, opening_cents INTEGER NOT NULL,
      charge_cents INTEGER NOT NULL DEFAULT 0, allocation_pending INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (organisation_id, payment_id)
    );
  `);
  const attempt = (org, id) => db.prepare('SELECT * FROM fin_stripe_refund_attempts WHERE organisation_id=? AND refund_id=?').get(org, id);
  const finTable = () => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='fin_refunds'").get());
  const payment = (org, id) => db.prepare("SELECT * FROM job_payments WHERE organisation_id=? AND id=? AND provider='stripe'").get(org, id);
  const done = (org, id) => finTable() ? db.prepare(`SELECT COALESCE(SUM(amount_cents),0) n FROM fin_refunds
    WHERE organisation_id=? AND payment_id=? AND provider='stripe' AND status='completed'`).get(org, id).n : 0;

  function initialise(p) {
    db.prepare(`INSERT OR IGNORE INTO fin_stripe_refund_totals (organisation_id,payment_id,opening_cents)
      VALUES (?,?,?)`).run(p.organisation_id, p.id, Math.max(0, (p.refunded_cents || 0) - done(p.organisation_id, p.id)));
  }

  function validTotal(p, value) {
    const currency = p.currency || 'aud';
    return stripeUnitsOrNull(p.amount_cents, currency) !== null &&
      stripeUnitsOrNull(p.refunded_cents || 0, currency) !== null &&
      Number.isSafeInteger(value) && value >= 0 && value <= p.amount_cents;
  }

  function update(p, total) {
    if (!validTotal(p, total)) throw new Error('Stripe refund totals need reconciliation.');
    const delta = total - (p.refunded_cents || 0);
    if (delta <= 0) return 0;
    const at = new Date().toISOString();
    db.prepare(`UPDATE job_payments SET refunded_cents=?,status=?,note='Refunded in Stripe',updated_at=?
      WHERE id=? AND organisation_id=?`).run(total, total === p.amount_cents ? 'refunded' : 'paid', at, p.id, p.organisation_id);
    const result = db.prepare(`UPDATE work_orders SET paid_cents=paid_cents-?,updated_at=?
      WHERE id=? AND organisation_id=? AND paid_cents>=?`).run(delta, at, p.work_order_id, p.organisation_id, delta);
    if (result.changes !== 1) throw new Error('Stripe refund job balance needs reconciliation.');
    return delta;
  }

  function totals(p) {
    return db.prepare('SELECT * FROM fin_stripe_refund_totals WHERE organisation_id=? AND payment_id=?').get(p.organisation_id, p.id);
  }

  function recordCharge(org, id, total, receipts = [], binding, authoritative = false) {
    const p = payment(org, id);
    initialise(p);
    const before = totals(p);
    const at = new Date().toISOString();
    if (finTable()) {
      for (const receipt of receipts) {
        if (receipt?.status !== 'succeeded' || typeof receipt.id !== 'string' || !receipt.id ||
            String(receipt.currency || '').toLowerCase() !== String(p.currency || 'aud').toLowerCase()) continue;
        const amount = ledgerFromStripeUnits(receipt.amount, p.currency || 'aud');
        if (amount === null || amount <= 0 || amount > total) continue;
        transition(org, p, receipt, binding, at, true);
      }
    }
    const tracked = done(org, id);
    const reserved = finTable() && db.prepare(`SELECT 1 FROM fin_refunds WHERE organisation_id=? AND payment_id=?
      AND provider='stripe' AND status='submitted' LIMIT 1`).get(org, id);
    const floor = Math.max(before.charge_cents, total);
    const succeeded = new Set(receipts.filter(receipt => receipt?.status === 'succeeded').map(receipt => receipt.id));
    const complete = authoritative && total >= before.charge_cents && (!finTable() || db.prepare(`SELECT provider_ref FROM fin_refunds
      WHERE organisation_id=? AND payment_id=? AND provider='stripe' AND status='completed'`).all(org, id)
      .every(row => succeeded.has(row.provider_ref)));
    const allocationPending = !complete && Boolean(before.allocation_pending ||
      (reserved && floor > before.opening_cents + tracked));
    const opening = complete ? Math.max(0, total - tracked)
      : allocationPending || reserved ? before.opening_cents : Math.max(before.opening_cents, floor - tracked);
    db.prepare('UPDATE fin_stripe_refund_totals SET charge_cents=?,opening_cents=?,allocation_pending=? WHERE organisation_id=? AND payment_id=?')
      .run(floor, opening, Number(allocationPending), org, id);
    return update(p, Math.max(floor, opening + tracked));
  }

  function transition(org, p, receipt, binding, at, chargeContext = false) {
    const amount = ledgerFromStripeUnits(receipt.amount, p.currency || 'aud');
    if (amount === null || amount <= 0 || typeof receipt.id !== 'string' || !receipt.id ||
        String(receipt.currency || '').toLowerCase() !== String(p.currency || 'aud').toLowerCase()) return null;
    if ((!chargeContext || receipt.payment_intent !== undefined) && receipt.payment_intent !== p.reference) return null;
    const metadata = receipt.metadata || {};
    if ((metadata.organisation_id !== undefined && metadata.organisation_id !== org) ||
        (metadata.payment_id !== undefined && metadata.payment_id !== p.id)) return null;
    const matches = db.prepare(`SELECT * FROM fin_refunds WHERE organisation_id=? AND payment_id=? AND provider='stripe'
      AND (provider_ref=? OR id=?)`).all(org, p.id, receipt.id, metadata.refund_request_id || '');
    if (matches.length !== 1) return null;
    const [r] = matches;
    const claim = attempt(org, r.id);
    if (r.amount_cents !== amount || (metadata.refund_request_id !== undefined && metadata.refund_request_id !== r.id) || (r.provider_ref && r.provider_ref !== receipt.id) ||
        (claim && claim.account_binding !== binding) ||
        (!r.provider_ref && (!claim || metadata.organisation_id !== org ||
          metadata.payment_id !== p.id || metadata.refund_request_id !== r.id))) return null;
    if (r.status !== 'submitted') return r;
    const status = { succeeded: 'completed', failed: 'failed', canceled: 'canceled', pending: 'submitted', requires_action: 'submitted' }[receipt.status];
    if (!['submitted', 'completed', 'failed', 'canceled'].includes(status)) return null;
    db.prepare('UPDATE fin_refunds SET status=?,provider_ref=?,error=NULL,updated_at=? WHERE organisation_id=? AND id=?')
      .run(status, receipt.id, at, org, r.id);
    return { ...r, status, provider_ref: receipt.id };
  }

  const applyReceipt = db.transaction((org, id, receipt, binding, after) => {
    const p = payment(org, id);
    if (!p || !finTable() || !validTotal(p, p.refunded_cents || 0)) return null;
    initialise(p);
    const row = transition(org, p, receipt, binding, new Date().toISOString());
    if (!row) return null;
    const state = totals(p);
    update(p, Math.max(state.charge_cents, state.opening_cents + done(org, id)));
    after?.(row);
    return row;
  });

  function needsAllocation(p) {
    const state = totals(p);
    return Boolean(state?.allocation_pending);
  }

  function unsettledBindings(org, id) {
    if (!finTable()) return [];
    return db.prepare(`SELECT DISTINCT a.account_binding FROM fin_refunds r JOIN fin_stripe_refund_attempts a
      ON a.organisation_id=r.organisation_id AND a.refund_id=r.id
      WHERE r.organisation_id=? AND r.payment_id=? AND r.status='submitted'`).all(org, id);
  }
  return { attempt, initialise, payment, validTotal, recordCharge, applyReceipt, needsAllocation, unsettledBindings };
}
