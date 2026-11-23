// TR-23 review fixes, checked against a sample business built through the API: quotes waiting for approval count
// as waiting for a decision, and customers with jobs are no longer labelled as future customers.
import test from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './test-server.mjs';
import { seedOwner } from './visual/session.mjs';
import { seedSampleBusiness } from './visual/sample-data.mjs';

test('approval count includes quotes waiting for approval; customers with jobs are current', async () => {
  const s = await startServer({});
  try {
    const o = await seedOwner(s, {}); await seedSampleBusiness(s, o);
    const cc = await s.call('GET', '/api/saas/command-centre', { cookie: o.cookie });
    assert.equal(cc.status, 200, cc.text);
    assert.equal(cc.json.approvals.pending, 1, 'the one sample quote waiting for approval is counted');
    const list = await s.call('GET', '/api/saas/customers', { cookie: o.cookie });
    const by = Object.fromEntries(list.json.customers.map((c) => [c.name, c.status]));
    assert.equal(by['Sam Rivera'], 'current', 'completed job');
    assert.equal(by['Priya Nair'], 'current', 'booked job');
    assert.equal(by['Daniel Kim'], 'lead', 'enquiry only');
    const current = await s.call('GET', '/api/saas/customers?status=current', { cookie: o.cookie });
    assert.ok(current.json.customers.some((c) => c.name === 'Sam Rivera'), 'the filter uses the same label');
  } finally { await s.stop(); }
});
