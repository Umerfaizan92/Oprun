// Sample business data for visual reviews: a small plumbing business with records at every pipeline stage.
// Everything is created through the same API the workspace uses, so it is shaped exactly like real data.
// Example names and addresses only; no real people.
export async function seedSampleBusiness(server, owner) {
  const call = async (method, url, body) => {
    const r = await server.call(method, url, { cookie: owner.cookie, body });
    if (r.status >= 400) throw new Error(`${method} ${url} -> ${r.status} ${r.text}`);
    return r.json;
  };
  const day = (n, h = 9) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d.toISOString(); };
  const people = [
    ['Sam Rivera', '0400 100 201', 'sam.rivera@example.test', '4/12 Beach Rd, Scarborough WA'],
    ['Priya Nair', '0400 100 202', 'priya.nair@example.test', '18 Hale St, Fremantle WA'],
    ['Tom Becker', '0400 100 203', 'tom.becker@example.test', '7 Kings Park Rd, West Perth WA'],
    ['Leila Hassan', '0400 100 204', 'leila.hassan@example.test', '33 Albany Hwy, Victoria Park WA'],
    ['Grace Okafor', '0400 100 205', 'grace.okafor@example.test', '9 Marine Pde, Cottesloe WA'],
    ['Daniel Kim', '0400 100 206', 'daniel.kim@example.test', '61 Oxford St, Leederville WA']
  ];
  const work = [
    ['Leaking hot water system', 'Water pooling under the tank in the laundry.', 'phone', 1450],
    ['Blocked kitchen drain', 'Sink drains slowly; tried a plunger.', 'website', 380],
    ['Bathroom renovation rough-in', 'New vanity, shower and toilet positions.', 'referral', 6800],
    ['Burst pipe under driveway', 'Water meter spinning with all taps off.', 'phone', 2200],
    ['Install outdoor tap', 'One new tap on the back wall near the garden.', 'email', 290],
    ['Annual backflow test', 'Commercial kitchen, two devices.', 'email', 540]
  ];
  const out = { enquiries: [], quotes: [], jobs: [], invoices: [] };
  for (let i = 0; i < work.length; i++) {
    const [name, phone, email, address] = people[i], [title, details, channel, amount] = work[i];
    const e = await call('POST', '/api/saas/pipeline/enquiries', { title, details, channel, customer: { name, phone, email, address } });
    out.enquiries.push(e.id);
    if (i >= 4) continue; // two stay as new enquiries
    const q = await call('POST', `/api/saas/pipeline/enquiries/${e.id}/quote`, { amount, gst_applies: true, title });
    out.quotes.push(q.id);
    if (i === 3) continue; // one quote waits for approval
    await call('POST', `/api/saas/business-hub/quote/${q.id}/approve`, { revision: 1 });
    await call('POST', `/api/saas/business-hub/quote/${q.id}/accept`, { revision: 1, evidence: 'Accepted by phone (sample data)' });
    const b = await call('POST', `/api/saas/pipeline/quotes/${q.id}/book`, { start_at: day(i === 0 ? -3 : i, 9 + i), revision: 1, estimated_hours: 2 + i, required_workers: 1, address });
    out.jobs.push(b.work_order_id);
    if (i !== 0) continue; // one job is completed and invoiced; the others stay booked
    await call('POST', `/api/saas/pipeline/jobs/${b.work_order_id}/complete`, {});
    const inv = await call('POST', `/api/saas/pipeline/jobs/${b.work_order_id}/invoice`, {});
    await call('POST', `/api/saas/business-hub/invoice/${inv.id}/approve`, { revision: 1 });
    await call('POST', `/api/saas/pipeline/invoices/${inv.id}/issue`, {});
    out.invoices.push(inv.id);
  }
  for (const [full_name, role_title, employment_type, work_status] of [
    ['Jordan Lee', 'Licensed plumber', 'full_time', 'australian_citizen'],
    ['Mia Thompson', 'Apprentice plumber', 'apprentice', 'permanent_resident'],
    ['Ravi Patel', 'Gas fitter', 'contractor', 'requires_review']
  ]) await call('POST', '/api/saas/workers', { full_name, role_title, employment_type, worker_level: 2, work_status });
  for (const [name, unit, cost, reorder_level, reorder_qty] of [['PEX pipe 16mm', 'metre', 2.4, 50, 200], ['Flick mixer tap', 'each', 89, 2, 6], ['Thread seal tape', 'roll', 1.2, 20, 100]])
    await call('POST', '/api/saas/stock/items', { name, unit, cost, reorder_level, reorder_qty });
  for (const [name, amount, period] of [['Van lease', 650, 'monthly'], ['Public liability insurance', 2400, 'yearly']])
    await call('POST', '/api/saas/finance/overheads', { name, amount, period });
  return out;
}
