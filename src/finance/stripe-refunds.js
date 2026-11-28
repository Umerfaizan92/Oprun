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
    CREATE TABLE IF NOT EXISTS fin_stripe_refund_lifecycle (
      organisation_id TEXT NOT NULL, payment_id TEXT NOT NULL, refund_id TEXT NOT NULL,
      event_id TEXT NOT NULL, event_created INTEGER, provider_status TEXT NOT NULL,
      delta_cents INTEGER NOT NULL, PRIMARY KEY (organisation_id,event_id)
    );
    CREATE TRIGGER IF NOT EXISTS fin_stripe_refund_lifecycle_no_update
      BEFORE UPDATE ON fin_stripe_refund_lifecycle BEGIN SELECT RAISE(ABORT, 'Stripe refund lifecycle is append-only'); END;
    CREATE TRIGGER IF NOT EXISTS fin_stripe_refund_lifecycle_no_delete
      BEFORE DELETE ON fin_stripe_refund_lifecycle BEGIN SELECT RAISE(ABORT, 'Stripe refund lifecycle is append-only'); END;
    CREATE TRIGGER IF NOT EXISTS fin_stripe_refund_lifecycle_no_replace
      BEFORE INSERT ON fin_stripe_refund_lifecycle
      WHEN EXISTS (SELECT 1 FROM fin_stripe_refund_lifecycle WHERE organisation_id=NEW.organisation_id AND event_id=NEW.event_id)
      BEGIN SELECT RAISE(ABORT, 'Stripe refund lifecycle is append-only'); END;
    CREATE TABLE IF NOT EXISTS fin_stripe_refund_discrepancies (
      organisation_id TEXT NOT NULL, event_id TEXT NOT NULL, payment_id TEXT NOT NULL,
      account_binding TEXT, evidence_json TEXT NOT NULL, reason TEXT NOT NULL, resolved_at TEXT,
      PRIMARY KEY (organisation_id,event_id)
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

  function update(p, total, allowDecrease = false) {
    if (!validTotal(p, total)) throw new Error('Stripe refund totals need reconciliation.');
    const delta = total - (p.refunded_cents || 0);
    if (delta === 0 || (delta < 0 && !allowDecrease)) return 0;
    const at = new Date().toISOString();
    db.prepare(`UPDATE job_payments SET refunded_cents=?,status=?,note='Refunded in Stripe',updated_at=?
      WHERE id=? AND organisation_id=?`).run(total, total === p.amount_cents ? 'refunded' : 'paid', at, p.id, p.organisation_id);
    const result = db.prepare(`UPDATE work_orders SET paid_cents=paid_cents-?,updated_at=?
      WHERE id=? AND organisation_id=? AND paid_cents>=MAX(0,?)`).run(delta, at, p.work_order_id, p.organisation_id, delta);
    if (result.changes !== 1) throw Object.assign(new Error('Stripe refund job balance needs reconciliation.'), { code: 'STRIPE_JOB_BALANCE_CONFLICT' });
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
    const reversed = db.prepare(`SELECT 1 FROM fin_stripe_refund_lifecycle WHERE organisation_id=? AND payment_id=? AND delta_cents<0 LIMIT 1`).get(org, id);
    // A delayed charge snapshot may still include a refund we already reversed.
    const contradicted = reversed && authoritative && db.prepare(`SELECT DISTINCT r.provider_ref
      FROM fin_refunds r JOIN fin_stripe_refund_lifecycle l ON l.organisation_id=r.organisation_id AND l.refund_id=r.id
      WHERE r.organisation_id=? AND r.payment_id=? AND r.status<>'completed' AND l.delta_cents<0`).all(org,id)
      .some(row => receipts.some(receipt => receipt.id === row.provider_ref && receipt.status === 'succeeded'));
    if (contradicted || (reversed && !authoritative && total > (p.refunded_cents || 0))) {
      throw Object.assign(new Error('Charge total follows a reversed refund and requires evidence.'), { code: 'STRIPE_JOB_BALANCE_CONFLICT' });
    }
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

  function transition(org, p, receipt, binding, at, chargeContext = false, lifecycle) {
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
    const prior = db.prepare(`SELECT * FROM fin_stripe_refund_lifecycle WHERE organisation_id=? AND refund_id=?
      ORDER BY rowid DESC LIMIT 1`).get(org, r.id);
    if (lifecycle && db.prepare('SELECT 1 FROM fin_stripe_refund_lifecycle WHERE organisation_id=? AND event_id=?').get(org, lifecycle.id)) return null;
    if (lifecycle?.expectedPrior && prior?.event_id !== lifecycle.expectedPrior) {
      throw Object.assign(new Error('Refund state changed during provider verification.'), { code: 'STRIPE_REFUND_ORDER_CONFLICT' });
    }
    if (prior?.event_created != null && lifecycle?.created != null) {
      if (lifecycle.created < prior.event_created) return null;
      if (lifecycle.created === prior.event_created && receipt.status !== prior.provider_status && !lifecycle.authoritative) {
        throw Object.assign(new Error('Distinct refund events share a timestamp.'), {
          code: 'STRIPE_REFUND_ORDER_CONFLICT', priorEventId: prior.event_id,
        });
      }
    }
    const reversal = r.status === 'completed' && lifecycle && (
      (lifecycle.type === 'refund.failed' && receipt.status === 'failed' &&
        (lifecycle.authoritative || lifecycle.created == null || lifecycle.created >= Math.floor(Date.parse(r.updated_at) / 1000))) ||
      (lifecycle.type === 'refund.updated' && receipt.status === 'requires_action' &&
        Boolean(receipt.next_action?.type) && (lifecycle.authoritative || (Number.isSafeInteger(lifecycle.created) &&
        lifecycle.created > Math.floor(Date.parse(r.updated_at) / 1000))))
    );
    if (r.status !== 'submitted' && !reversal) return r;
    // Once a refund re-enters requires_action, an older success or an undated snapshot cannot settle it again.
    if (r.status === 'submitted' && prior?.provider_status === 'requires_action' && prior.delta_cents < 0 &&
        receipt.status === 'succeeded' && (!lifecycle || !lifecycle.authoritative && !Number.isSafeInteger(lifecycle.created))) return null;
    const status = { succeeded: 'completed', failed: 'failed', canceled: 'canceled', pending: 'submitted', requires_action: 'submitted' }[receipt.status];
    if (!['submitted', 'completed', 'failed', 'canceled'].includes(status)) return null;
    db.prepare('UPDATE fin_refunds SET status=?,provider_ref=?,error=NULL,updated_at=? WHERE organisation_id=? AND id=?')
      .run(status, receipt.id, at, org, r.id);
    if (lifecycle) db.prepare(`INSERT INTO fin_stripe_refund_lifecycle
      (organisation_id,payment_id,refund_id,event_id,event_created,provider_status,delta_cents) VALUES (?,?,?,?,?,?,?)`)
      .run(org, p.id, r.id, lifecycle.id, lifecycle.created ?? null, receipt.status, reversal ? -amount : 0);
    return { ...r, status, provider_ref: receipt.id, reversed_cents: reversal ? amount : 0 };
  }

  const applyReceipt = db.transaction((org, id, receipt, binding, after, lifecycle) => {
    const p = payment(org, id);
    if (!p || !finTable() || !validTotal(p, p.refunded_cents || 0)) return null;
    initialise(p);
    const row = transition(org, p, receipt, binding, new Date().toISOString(), false, lifecycle);
    if (!row) return null;
    const state = totals(p);
    if (row.reversed_cents) {
      const next = (p.refunded_cents || 0) - row.reversed_cents;
      db.prepare('UPDATE fin_stripe_refund_totals SET charge_cents=MIN(charge_cents,?) WHERE organisation_id=? AND payment_id=?')
        .run(next, org, id);
      update(p, next, true);
    } else update(p, Math.max(state.charge_cents, state.opening_cents + done(org, id)));
    after?.(row);
    return row;
  });

  function needsAllocation(p) {
    const state = totals(p);
    return Boolean(state?.allocation_pending || db.prepare(`SELECT 1 FROM fin_stripe_refund_discrepancies
      WHERE organisation_id=? AND payment_id=? AND resolved_at IS NULL`).get(p.organisation_id, p.id));
  }

  function unsettledBindings(org, id) {
    if (!finTable()) return [];
    return db.prepare(`SELECT DISTINCT a.account_binding FROM fin_refunds r JOIN fin_stripe_refund_attempts a
      ON a.organisation_id=r.organisation_id AND a.refund_id=r.id
      WHERE r.organisation_id=? AND r.payment_id=? AND r.status='submitted'`).all(org, id);
  }
  function paymentBindings(org, id) {
    return db.prepare(`SELECT DISTINCT account_binding FROM fin_stripe_refund_attempts
      WHERE organisation_id=? AND payment_id=? AND account_binding LIKE 'stripe:acct_%'`).all(org, id).map(row => row.account_binding);
  }
  return { paymentBindings, attempt, initialise, payment, validTotal, recordCharge, applyReceipt, needsAllocation, unsettledBindings };
}
