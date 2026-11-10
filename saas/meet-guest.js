// T-074 Guest page: a customer opens the private link, gives a name, waits to be let in, then joins the call.
// The link's key stays in the part of the address after # so it is never sent in a page request or stored in logs.
(() => {
  const $ = (id) => document.getElementById(id);
  const status = $('guest-status'), form = $('guest-form'), title = $('guest-title'), main = $('guest-main'), callBox = $('guest-call');
  const say = (text, bad = false) => { status.textContent = text; status.dataset.tone = bad ? 'bad' : 'ok'; };
  const meetingId = new URLSearchParams(location.search).get('m') || '';
  const token = new URLSearchParams(location.hash.replace(/^#/, '')).get('t') || '';
  const post = async (path, body) => { const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); let d = {}; try { d = await r.json(); } catch { /* not JSON */ } if (!r.ok || d.ok === false) { const e = new Error(d.error || 'This did not work. Try again.'); e.code = d.code; throw e; } return d; };

  async function waitToBeLetIn(secret) {
    let failures = 0;
    for (;;) {
      try {
        const r = await fetch('/api/public/meetings/waiting', { headers: { 'X-Meeting-Waiting': secret } });
        if (r.status === 410) return { status: 'expired' };
        if (!r.ok) throw new Error('wait ' + r.status);
        failures = 0;
        const d = await r.json();
        if (d.status !== 'waiting') return d;
        say(d.host_present ? 'Waiting for the business to let you in…' : 'Nobody from the business has joined yet. Keep this page open; you will be let in when they arrive.');
      } catch { if (++failures >= 6) return { status: 'lost' }; await new Promise((res) => setTimeout(res, 2000)); }
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = form.querySelector('button'); button.disabled = true;
    try {
      const k = await post(`/api/public/meetings/${encodeURIComponent(meetingId)}/knock`, { token, name: $('guest-name').value });
      form.hidden = true;
      say(k.host_present ? 'Waiting for the business to let you in…' : 'Nobody from the business has joined yet. Keep this page open; you will be let in when they arrive.');
      const answer = await waitToBeLetIn(k.waiting_secret);
      if (answer.status === 'admitted') {
        main.hidden = true; callBox.hidden = false;
        window.SuperProCall.start({ mount: callBox, join: answer.join, onClose: (reason, text) => { callBox.hidden = true; callBox.replaceChildren(); main.hidden = false; say(text + (reason === 'ended' ? '' : ' You can ask to join again.')); form.hidden = reason === 'ended'; button.disabled = false; } });
        return;
      }
      say({ declined: 'The business did not let you in this time.', ended: 'This meeting has ended.', expired: 'Your request timed out. Ask to join again.', lost: 'The connection was lost. Ask to join again.' }[answer.status] || 'You could not be let in. Ask to join again.', true);
      form.hidden = answer.status === 'ended'; button.disabled = false;
    } catch (err) { say(err.message, true); button.disabled = false; }
  });

  (async () => {
    if (!meetingId || !token) return say('This meeting link is incomplete. Ask the business for a new link.', true);
    try {
      const d = await post(`/api/public/meetings/${encodeURIComponent(meetingId)}/lookup`, { token });
      title.textContent = d.meeting.title;
      document.title = d.meeting.title + ' · ' + d.meeting.business;
      if (d.meeting.status !== 'open') return say('This meeting has ended.', true);
      say(`${d.meeting.business} invited you to a ${d.meeting.mode === 'voice' ? 'voice' : 'video'} call.`);
      form.hidden = false; $('guest-name').focus();
    } catch (err) { say(err.message, true); }
  })();
})();
