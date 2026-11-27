// Homepage-only captions recovered from the supplied cinematic preview.
// Use media time rather than a second clock so buffering, seeking and loops stay aligned.
(() => {
  const video = document.querySelector('.sp-film__video');
  const caption = document.querySelector('.sp-film__caption');
  if (!video || !caption) return;
  const beats = [[0.0, "The world", "Ready."], [8.0, "Phone", "Answered."], [10.1, "AI Receptionist", "Completed."], [12.3, "Enquiries", "Logged."], [14.4, "Customer Directory", "Filed."], [16.6, "Unified Inbox", "Gathered."], [18.7, "Email", "Drafted."], [20.9, "Team Chat", "Briefed."], [23.0, "Command Centre", "Assembled."], [26.0, "AI Assistant", "Written."], [29.0, "Quotes", "Priced."], [32.0, "Approvals", "Held."], [35.0, "Bookings", "Booked."], [38.0, "Appointments", "Set."], [43.0, "Calendar", "Organised."], [48.0, "Video meeting", "Arranged."], [53.0, "Workers & Compliance", "Cleared."], [56.0, "Staff Accounts & Roles", "Assigned."], [59.0, "Hiring", "Noted."], [62.0, "Stock & Supplies", "Stocked."], [65.0, "Jobs", "Finished."], [68.0, "Invoices", "Invoiced."], [70.5, "Payments", "Recorded."], [73.0, "Bank Reconciliation", "Reconciled."], [75.5, "Profit & Payments", "Posted."], [78.0, "Reports", "Reported."], [80.5, "Print & Export", "Exported."], [83.0, "Media Studio", "Produced."], [86.0, "Campaign Studio", "Prepared."], [89.0, "Website", "Published."], [92.0, "Search", "Indexed."], [95.0, "Growth Hub", "Growing."], [98.0, "Social", "Published."], [103.0, "Google", "Listed."], [108.0, "SEO", "Ranked."], [113.0, "AI Automations", "Running."], [115.5, "Brand & Settings", "Set."], [118.0, "Connections", "Connected."], [120.5, "Plans & usage", "Checked."], [123.0, "Trust & Security", "Secured."], [125.5, "Import", "Imported."], [128.0, "The day", "Accomplished."]];
  const number = caption.querySelector('.sp-film__number');
  const title = caption.querySelector('.sp-film__title');
  const status = caption.querySelector('.sp-film__status');
  let current = -1;
  function sync() {
    let index = 0;
    for (let i = 1; i < beats.length && video.currentTime >= beats[i][0]; i++) index = i;
    if (index === current) return;
    current = index;
    number.textContent = index > 0 && index < beats.length - 1 ? String(index).padStart(2, '0') : '';
    title.textContent = beats[index][1];
    status.textContent = beats[index][2];
  }
  ['timeupdate', 'loadedmetadata', 'seeked', 'playing', 'emptied'].forEach(event => video.addEventListener(event, sync));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  function motion() { if (reduced.matches) video.pause(); else video.play().catch(() => {}); }
  reduced.addEventListener('change', motion);
  sync();
  motion();
})();
