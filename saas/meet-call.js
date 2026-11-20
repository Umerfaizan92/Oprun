// T-074 In-call engine shared by the workspace and the guest page. Sound and picture go directly between browsers
// (WebRTC); the server only passes the short setup messages. The newest person to join always makes the first offer
// to each person already in the room, so two browsers never offer to each other at the same moment.
(() => {
  if (window.SuperProCall) return;
  const el = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k !== null && k !== undefined && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
    return e;
  };

  /**
   * Starts a call inside `mount`.
   * join: the server's join answer. host: { admit(id, allow), end(), guestLink } for organisers, else null.
   */
  // ---- T-184: video quality and backgrounds ----
  // Quality is what the camera is asked for; the browser sends the best the camera and the connection allow.
  const QUALITY = { sd: ['Standard (360p)', 640, 360, 800e3], hd: ['HD (720p)', 1280, 720, 2.5e6], fhd: ['Full HD (1080p)', 1920, 1080, 4.5e6], uhd: ['4K Ultra HD (if your camera supports it)', 3840, 2160, 12e6] };
  const store = { get: (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
  const BG = { none: 'No effect', blur: 'Blur background', office: 'Office', studio: 'Studio', midnight: 'Midnight', image: 'My own picture' };
  const PRESET = { office: ['#d9d4c7', '#a89f8b', '#5c574c'], studio: ['#1d2b3a', '#3b5470', '#0d1520'], midnight: ['#0b0f1a', '#3a2a55', '#c99436'] };
  function presetImage(name, w = 1280, h = 720) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); const [a, b2, d] = PRESET[name];
    const lg = g.createLinearGradient(0, 0, w, h); lg.addColorStop(0, a); lg.addColorStop(.6, b2); lg.addColorStop(1, d); g.fillStyle = lg; g.fillRect(0, 0, w, h);
    const rg = g.createRadialGradient(w * .75, h * .25, 10, w * .75, h * .25, w * .6); rg.addColorStop(0, 'rgba(255,255,255,.28)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, w, h);
    return c;
  }
  let segLoad = null;
  function loadSegmenter() {
    if (window.SelfieSegmentation) return Promise.resolve();
    return segLoad ||= new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = '/saas/vendor/mediapipe/selfie_segmentation/selfie_segmentation.js'; sc.onload = res; sc.onerror = () => { segLoad = null; rej(new Error('Background effects could not load.')); }; document.head.append(sc); });
  }
  // Returns a new video track with the background blurred or replaced; stop() releases it.
  async function backgroundTrack(camera, mode, picture) {
    await loadSegmenter();
    const s = camera.getSettings(), w = s.width || 1280, h = s.height || 720;
    const video = document.createElement('video'); video.muted = true; video.playsInline = true; video.srcObject = new MediaStream([camera]); await video.play().catch(() => {});
    const out = document.createElement('canvas'); out.width = w; out.height = h; const g = out.getContext('2d');
    const backdrop = mode === 'image' ? picture : mode === 'blur' ? null : presetImage(mode, w, h);
    const seg = new window.SelfieSegmentation({ locateFile: (f) => '/saas/vendor/mediapipe/selfie_segmentation/' + f });
    seg.setOptions({ modelSelection: 1, selfieMode: false });
    seg.onResults((r) => {
      g.save(); g.clearRect(0, 0, w, h);
      g.drawImage(r.segmentationMask, 0, 0, w, h);
      g.globalCompositeOperation = 'source-in'; g.drawImage(r.image, 0, 0, w, h);
      g.globalCompositeOperation = 'destination-over';
      if (backdrop) { const iw = backdrop.width || backdrop.naturalWidth, ih = backdrop.height || backdrop.naturalHeight, k = Math.max(w / iw, h / ih); g.drawImage(backdrop, (w - iw * k) / 2, (h - ih * k) / 2, iw * k, ih * k); }
      else { g.filter = 'blur(16px)'; g.drawImage(r.image, 0, 0, w, h); g.filter = 'none'; }
      g.restore();
    });
    let running = true;
    const tick = async () => { if (!running) return; if (video.readyState >= 2) { try { await seg.send({ image: video }); } catch { /* frame skipped */ } } if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(tick); else setTimeout(tick, 33); };
    tick();
    const track = out.captureStream(30).getVideoTracks()[0];
    return { track, stop: () => { running = false; track.stop(); seg.close?.(); video.srcObject = null; } };
  }

  function start({ mount, join, host = null, waiting = [], onClose = () => {} }) {
    const secret = join.peer_secret, selfId = join.peer_id, voiceOnly = join.meeting.mode === 'voice';
    const peers = new Map(); // id -> { info, pc, tile, pending: [], initiator, restarted }
    let localStream = new MediaStream(), cameraTrack = null, micTrack = null, screenTrack = null, closed = false, pollFailures = 0, waitingNow = waiting;
    let quality = store.get('oprun-call-quality', 'hd'), background = store.get('oprun-call-background', 'none'), effect = null, picture = null;
    if (!QUALITY[quality]) quality = 'hd'; if (!BG[background] || background === 'image') background = 'none';
    const camOut = () => (effect?.track || cameraTrack);
    const state = { audio: false, video: false, sharing: false };

    const call = (path, opt = {}) => fetch('/api/meetings/call/' + path, { ...opt, headers: { 'Content-Type': 'application/json', 'X-Meeting-Peer': secret, ...(opt.headers || {}) } });
    const send = (to, data) => call('signal', { method: 'POST', body: JSON.stringify({ to, data }) }).catch(() => {});
    const publish = () => call('state', { method: 'POST', body: JSON.stringify(state) }).catch(() => {});

    // ---- layout ----
    const status = el('p', { class: 'mc-status', role: 'status', 'aria-live': 'polite' });
    const count = el('span', { class: 'mc-count' });
    const grid = el('div', { class: 'mc-grid' });
    const waitBox = el('section', { class: 'mc-waiting', 'aria-label': 'People waiting to join', hidden: true });
    const say = (text, bad = false) => { status.textContent = text; status.dataset.tone = bad ? 'bad' : 'ok'; };
    const toggle = (label, pressed, onclick) => el('button', { type: 'button', class: 'mc-btn', 'aria-pressed': String(pressed), text: label, onclick });
    const micBtn = toggle('Microphone off', false, () => setMic(!state.audio));
    const camBtn = toggle('Camera off', false, () => setCamera(!state.video));
    const shareBtn = navigator.mediaDevices?.getDisplayMedia ? toggle('Share screen', false, () => (state.sharing ? stopShare() : startShare())) : null;
    const leaveBtn = el('button', { type: 'button', class: 'mc-btn mc-leave', text: 'Leave call', onclick: () => close('left') });
    // Quality and background panel (video calls only).
    const fxPanel = el('section', { class: 'mc-fx', hidden: true, 'aria-label': 'Video quality and background' });
    const radios = (name, opts, current, onpick) => el('fieldset', { class: 'mc-fx-group' }, el('legend', { text: name === 'q' ? 'Video quality' : 'Background' }),
      ...Object.entries(opts).map(([k, v]) => el('label', { class: 'mc-fx-opt' }, el('input', { type: 'radio', name: 'mc-' + name, value: k, checked: k === current || null, onchange: () => onpick(k) }), ' ', Array.isArray(v) ? v[0] : v)));
    const fileIn = el('input', { type: 'file', accept: 'image/*', class: 'mc-fx-file', 'aria-label': 'Choose a background picture', onchange: async () => {
      const f = fileIn.files?.[0]; if (!f) return; const img = new Image(); img.src = URL.createObjectURL(f); await img.decode().catch(() => {}); picture = img; await applyBackground('image');
      fxPanel.querySelector('input[name=mc-b][value=image]').checked = true; } });
    const drawFx = () => fxPanel.replaceChildren(
      radios('q', QUALITY, quality, (k) => setQuality(k)),
      radios('b', BG, background, (k) => { if (k === 'image') { if (picture) applyBackground('image'); else fileIn.click(); } else applyBackground(k); }),
      fileIn,
      el('p', { class: 'mc-fx-note', text: 'Your picture stays on this device. 8K is not offered: webcams and browsers cannot capture it. Higher quality uses more data; on a slow connection the browser lowers it automatically.' }));
    const fxBtn = voiceOnly ? null : el('button', { type: 'button', class: 'mc-btn', 'aria-expanded': 'false', text: 'Quality & background', onclick: () => { if (fxPanel.hidden) drawFx(); openOnly(fxPanel, fxBtn); } });
    const endBtn = host ? el('button', { type: 'button', class: 'mc-btn mc-end', text: 'End for everyone', onclick: async () => { if (!confirm('End this meeting for everyone?')) return; endBtn.disabled = true; try { await host.end(); } catch (e) { say(e.message, true); endBtn.disabled = false; } } }) : null;
    // ---- T-186: full screen ----
    const fsTarget = mount;
    const canFs = Boolean(fsTarget.requestFullscreen || fsTarget.webkitRequestFullscreen);
    const inFs = () => Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    const fsBtn = el('button', { type: 'button', class: 'mc-btn', 'aria-pressed': 'false', text: 'Full screen', onclick: async () => {
      try {
        if (inFs()) { await (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
        if (canFs) { await (fsTarget.requestFullscreen || fsTarget.webkitRequestFullscreen).call(fsTarget, { navigationUI: 'hide' }); return; }
        // iPhone Safari has no full screen for a page section: open the main video in the phone's own player instead.
        const v = grid.querySelector('.mc-tile:not(.mc-novideo) video:not(.mc-self)') || grid.querySelector('video');
        if (v?.webkitEnterFullscreen) v.webkitEnterFullscreen(); else say('This browser does not allow full screen. Turn your phone sideways for a bigger picture.', true);
      } catch { say('Full screen was blocked by the browser.', true); }
    } });
    const onFs = () => { const on = inFs(); fsBtn.textContent = on ? 'Exit full screen' : 'Full screen'; fsBtn.setAttribute('aria-pressed', String(on)); mount.classList.toggle('mc-fullscreen', on); };
    document.addEventListener('fullscreenchange', onFs); document.addEventListener('webkitfullscreenchange', onFs);

    // ---- T-186: invite from inside the call (organisers) ----
    let guestLink = host?.guestLink || null;
    const invitePanel = el('section', { class: 'mc-invite', hidden: true, 'aria-label': 'Invite people' });
    const copyLink = async () => { if (!guestLink) return; try { await navigator.clipboard.writeText(guestLink); say('Guest link copied. Guests wait until you let them in.'); } catch { say('Copy is blocked in this browser. Select the link and copy it.', true); } };
    function drawInvite() {
      if (!guestLink) {
        invitePanel.replaceChildren(el('p', { text: 'Guests are not allowed in this meeting yet.' }),
          host.allowGuests ? el('button', { type: 'button', class: 'mc-btn mc-primary', text: 'Allow guests and make a link', onclick: async (e) => { e.currentTarget.disabled = true; try { guestLink = await host.allowGuests(); drawInvite(); } catch (x) { say(x.message, true); e.currentTarget.disabled = false; } } }) : null);
        return;
      }
      let channel = 'email';
      const to = el('input', { class: 'mc-input', type: 'email', inputmode: 'email', autocomplete: 'off', 'aria-label': 'Email address', placeholder: 'name@example.com' });
      const note = el('input', { class: 'mc-input', maxlength: 300, 'aria-label': 'Short note (optional)', placeholder: 'Short note (optional)' });
      const tabs = el('div', { class: 'mc-seg', role: 'radiogroup', 'aria-label': 'Send by' }, ...[['email', 'Email'], ['sms', 'Message (SMS)'], ['whatsapp', 'WhatsApp']].map(([k, label]) => el('button', { type: 'button', role: 'radio', 'aria-checked': String(k === channel), 'data-ch': k, text: label, onclick: () => {
        channel = k; tabs.querySelectorAll('[data-ch]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.ch === k)));
        to.type = k === 'email' ? 'email' : 'tel'; to.inputMode = k === 'email' ? 'email' : 'tel'; to.placeholder = k === 'email' ? 'name@example.com' : '0412 345 678'; to.setAttribute('aria-label', k === 'email' ? 'Email address' : 'Mobile number'); to.focus();
      } })));
      const sendBtn = el('button', { type: 'submit', class: 'mc-btn mc-primary', text: 'Send invitation' });
      const form = el('form', { class: 'mc-invite-form', onsubmit: async (e) => {
        e.preventDefault(); if (!to.value.trim()) { to.focus(); return; }
        sendBtn.disabled = true;
        try { const msg = await host.invite({ channel, to: to.value.trim(), message: note.value.trim() || undefined }); say(msg || 'Invitation sent.'); to.value = ''; note.value = ''; }
        catch (x) { say(x.message, true); } finally { sendBtn.disabled = false; }
      } }, tabs, el('div', { class: 'mc-invite-row' }, to, sendBtn), note);
      const share = navigator.share ? el('button', { type: 'button', class: 'mc-btn', text: 'Share…', onclick: () => navigator.share({ title: join.meeting.title, text: `Join "${join.meeting.title}"`, url: guestLink }).catch(() => {}) }) : null;
      invitePanel.replaceChildren(form,
        el('div', { class: 'mc-invite-row' }, el('input', { class: 'mc-input mc-link', readonly: true, value: guestLink, 'aria-label': 'Guest link', onfocus: (e) => e.target.select() }),
          el('button', { type: 'button', class: 'mc-btn', text: 'Copy guest link', onclick: copyLink }), share),
        el('p', { class: 'mc-fx-note', text: 'Invitations go from your business email and number. Guests wait until you let them in.' }));
    }
    const panels = () => [fxPanel, invitePanel, transcriptPanel];
    const openOnly = (panel, btn) => { const open = panel.hidden; for (const x of panels()) x.hidden = true; for (const b of [fxBtn, inviteBtn, transcriptBtn]) b?.setAttribute('aria-expanded', 'false'); panel.hidden = !open; btn.setAttribute('aria-expanded', String(open)); };
    const inviteBtn = host?.invite ? el('button', { type: 'button', class: 'mc-btn', 'aria-expanded': 'false', text: 'Invite', onclick: () => { if (invitePanel.hidden) drawInvite(); openOnly(invitePanel, inviteBtn); if (!invitePanel.hidden) invitePanel.querySelector('input')?.focus(); } }) : null;

    // ---- T-186: transcription. Each browser writes down its own person's speech; everyone sees captions. ----
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    let transcribing = Boolean(join.transcribing), recog = null, recogWanted = false, lines = [];
    const captions = el('div', { class: 'mc-captions', 'aria-live': 'polite', hidden: true });
    const transcriptPanel = el('section', { class: 'mc-transcript', hidden: true, 'aria-label': 'Transcript' });
    const banner = el('p', { class: 'mc-rec', hidden: true });
    function drawTranscript() {
      const list = el('ol', { class: 'mc-lines' }, ...lines.map((l) => el('li', {}, el('b', { text: l.speaker + ': ' }), l.text)));
      transcriptPanel.replaceChildren(
        lines.length ? list : el('p', { text: transcribing ? 'Nothing said yet. Lines appear here as people speak.' : 'Transcription is off.' }),
        host?.transcriptUrl ? el('a', { class: 'mc-btn', href: host.transcriptUrl, download: '', text: 'Download transcript' }) : null,
        el('p', { class: 'mc-fx-note', text: 'Saved automatically to this meeting. Each person\'s browser turns their own speech into text' + (SR ? '.' : '; this browser cannot, so your words are not written down. Chrome, Edge and Safari can.') }));
      list.lastElementChild?.scrollIntoView?.({ block: 'nearest' });
    }
    const transcriptBtn = el('button', { type: 'button', class: 'mc-btn', 'aria-expanded': 'false', text: 'Transcript', onclick: () => { drawTranscript(); openOnly(transcriptPanel, transcriptBtn); } });
    const recBtn = host ? el('button', { type: 'button', class: 'mc-btn', 'aria-pressed': String(transcribing), text: transcribing ? 'Stop transcribing' : 'Transcribe', onclick: async () => {
      if (!transcribing && !confirm('Turn on transcription? Everyone in the call will be told, and what people say will be saved as text in this meeting.')) return;
      recBtn.disabled = true;
      try { const r = await call('transcription', { method: 'POST', body: JSON.stringify({ on: !transcribing }) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Could not change transcription.'); setTranscribing(j.on, null); }
      catch (e) { say(e.message, true); } finally { recBtn.disabled = false; }
    } }) : null;
    function setTranscribing(on, by) {
      transcribing = on;
      if (recBtn) { recBtn.textContent = on ? 'Stop transcribing' : 'Transcribe'; recBtn.setAttribute('aria-pressed', String(on)); }
      banner.hidden = !on; banner.textContent = on ? 'Transcribing: what people say is being saved as text.' + (SR ? '' : ' Your browser cannot write down your speech.') : '';
      captions.hidden = !on;
      if (by) say(on ? `${by} turned on transcription.` : `${by} turned off transcription.`);
      syncRecognition(); if (!transcriptPanel.hidden) drawTranscript();
    }
    function syncRecognition() {
      const want = transcribing && state.audio && !closed && Boolean(SR);
      recogWanted = want;
      if (want && !recog) {
        recog = new SR(); recog.continuous = true; recog.interimResults = false; recog.lang = document.documentElement.lang && document.documentElement.lang !== 'en' ? document.documentElement.lang : (navigator.language || 'en-AU');
        recog.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) { const text = e.results[i][0].transcript.trim(); if (text) call('transcript', { method: 'POST', body: JSON.stringify({ text: text.slice(0, 1000) }) }).catch(() => {}); } };
        recog.onerror = (e) => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { recogWanted = false; say('Speech-to-text is blocked in this browser, so your words are not being written down.', true); } };
        // Browsers stop listening after a pause; start again while transcription is still wanted.
        recog.onend = () => { const r = recog; recog = null; if (recogWanted) setTimeout(() => { if (recogWanted && !recog) syncRecognition(); }, 400); else r?.abort?.(); };
        try { recog.start(); } catch { recog = null; }
      } else if (!want && recog) { const r = recog; recog = null; try { r.stop(); } catch { /* already stopped */ } }
    }
    function addLine(l) {
      lines.push(l); if (lines.length > 500) lines.shift();
      captions.replaceChildren(...lines.slice(-2).map((x) => el('p', {}, el('b', { text: x.speaker + ': ' }), x.text)));
      if (!transcriptPanel.hidden) drawTranscript();
    }
    const root = el('div', { class: 'mc-root', role: 'group', 'aria-label': 'Call: ' + join.meeting.title },
      el('header', { class: 'mc-head' }, el('h2', { text: join.meeting.title }), count),
      status, banner, waitBox, grid, captions,
      fxPanel, invitePanel, transcriptPanel,
      el('div', { class: 'mc-controls', role: 'toolbar', 'aria-label': 'Call controls' }, micBtn, camBtn, fxBtn, shareBtn, inviteBtn, recBtn, transcriptBtn, fsBtn, endBtn, leaveBtn),
      !join.relay_configured ? el('p', { class: 'mc-note', text: 'If someone cannot be seen or heard, their network may block direct calls. Ask them to try another network, such as mobile data.' }) : null);
    mount.replaceChildren(root);

    function tile(id, name, isSelf) {
      const video = el('video', { autoplay: true, playsinline: true, class: isSelf ? 'mc-video mc-self' : 'mc-video' });
      if (isSelf) video.muted = true;
      const label = el('span', { class: 'mc-name', text: isSelf ? name + ' (you)' : name });
      const flags = el('span', { class: 'mc-flags' });
      const off = el('div', { class: 'mc-avatar', 'aria-hidden': 'true', text: (name || '?').trim().charAt(0).toUpperCase() || '?' });
      const node = el('figure', { class: 'mc-tile', 'data-peer': id }, video, off, el('figcaption', {}, label, flags));
      grid.append(node);
      return { node, video, flags, off };
    }
    const selfTile = tile(selfId, join.self.name, true);
    function paint(t, info, connection = '') {
      t.off.hidden = Boolean(info.video || info.sharing);
      t.node.classList.toggle('mc-novideo', !(info.video || info.sharing));
      t.flags.textContent = [info.audio ? '' : 'Muted', info.sharing ? 'Sharing screen' : '', connection].filter(Boolean).join(' · ');
    }
    function refresh() {
      const n = peers.size + 1;
      count.textContent = n === 1 ? 'Only you are here' : `${n} people in this call`;
      grid.dataset.count = String(Math.min(n, 6));
      micBtn.textContent = state.audio ? 'Mute microphone' : 'Unmute microphone'; micBtn.setAttribute('aria-pressed', String(state.audio));
      camBtn.textContent = state.video ? 'Turn camera off' : 'Turn camera on'; camBtn.setAttribute('aria-pressed', String(state.video));
      if (shareBtn) { shareBtn.textContent = state.sharing ? 'Stop sharing' : 'Share screen'; shareBtn.setAttribute('aria-pressed', String(state.sharing)); }
      paint(selfTile, state);
    }
    function drawWaiting() {
      if (!host) return;
      waitBox.hidden = !waitingNow.length;
      waitBox.replaceChildren(el('h3', { text: waitingNow.length === 1 ? '1 guest is waiting' : `${waitingNow.length} guests are waiting` }),
        el('ul', {}, waitingNow.map((g) => el('li', {}, el('span', { text: g.name }),
          el('button', { type: 'button', class: 'mc-btn mc-admit', text: 'Let in', 'aria-label': 'Let in ' + g.name, onclick: (e) => decide(e, g.id, true) }),
          el('button', { type: 'button', class: 'mc-btn', text: 'Decline', 'aria-label': 'Decline ' + g.name, onclick: (e) => decide(e, g.id, false) })))));
    }
    async function decide(e, id, allow) {
      e.target.disabled = true;
      try { waitingNow = (await host.admit(id, allow)) || []; drawWaiting(); } catch (err) { say(err.message, true); e.target.disabled = false; }
    }

    // ---- media ----
    const videoOut = () => screenTrack || (state.video ? camOut() : null);
    function showLocal() {
      localStream = new MediaStream([micTrack, videoOut()].filter(Boolean));
      selfTile.video.srcObject = localStream;
      selfTile.video.classList.toggle('mc-self', !screenTrack); // a shared screen is not mirrored
    }
    async function replaceAll(kind, track) {
      for (const p of peers.values()) { const t = p.pc.getTransceivers().find((x) => x.receiver.track?.kind === kind); if (t) await t.sender.replaceTrack(track).catch(() => {}); }
    }
    async function setMic(on) {
      if (on && !micTrack) {
        try { micTrack = (await navigator.mediaDevices.getUserMedia({ audio: true })).getAudioTracks()[0]; await replaceAll('audio', micTrack); }
        catch { say('The microphone is not available. Allow it in your browser settings, then try again.', true); return; }
      }
      if (micTrack) micTrack.enabled = on;
      state.audio = Boolean(on && micTrack); showLocal(); refresh(); publish(); syncRecognition();
    }
    async function setCamera(on) {
      if (on && !cameraTrack) {
        try { const [, qw, qh] = QUALITY[quality]; cameraTrack = (await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: qw }, height: { ideal: qh }, frameRate: { ideal: 30 } } })).getVideoTracks()[0]; if (background !== 'none') await applyBackground(background, true); }
        catch { say('The camera is not available. Allow it in your browser settings, then try again.', true); return; }
      }
      if (cameraTrack) cameraTrack.enabled = on;
      state.video = Boolean(on && cameraTrack);
      if (!screenTrack) await replaceAll('video', state.video ? camOut() : null);
      showLocal(); refresh(); publish(); limitBitrate();
    }
    // Quality: ask the camera for the new size and let the connection carry it.
    async function limitBitrate() {
      const max = QUALITY[quality][3];
      for (const p of peers.values()) for (const sd of p.pc.getSenders()) if (sd.track?.kind === 'video') { const pr = sd.getParameters(); if (!pr.encodings?.length) pr.encodings = [{}]; pr.encodings[0].maxBitrate = max; await sd.setParameters(pr).catch(() => {}); }
    }
    async function setQuality(q) {
      quality = q; store.set('oprun-call-quality', q);
      if (cameraTrack) { const [, qw, qh] = QUALITY[q]; await cameraTrack.applyConstraints({ width: { ideal: qw }, height: { ideal: qh }, frameRate: { ideal: 30 } }).catch(() => {}); if (effect) await applyBackground(background, true); }
      await limitBitrate(); const st = cameraTrack?.getSettings?.() || {};
      say(st.width ? `Your camera is sending ${st.width} × ${st.height}${st.height < QUALITY[q][2] ? ' (the most it supports)' : ''}.` : 'Quality saved for your next call.');
    }
    async function applyBackground(mode, quiet = false) {
      const old = effect; effect = null;
      if (mode !== 'none' && cameraTrack) {
        try { if (!quiet) say('Preparing your background…'); effect = await backgroundTrack(cameraTrack, mode, picture); }
        catch (e) { say(e.message + ' Your normal camera is used.', true); mode = 'none'; }
      }
      background = mode; if (mode !== 'image') store.set('oprun-call-background', mode);
      if (state.video && !screenTrack) await replaceAll('video', camOut());
      old?.stop(); showLocal(); limitBitrate();
      if (!quiet && mode !== 'none' && effect) say(`${BG[mode]} is on. Only you see this panel; others see the result.`);
    }
    async function startShare() {
      try { screenTrack = (await navigator.mediaDevices.getDisplayMedia({ video: true })).getVideoTracks()[0]; } catch { return; }
      screenTrack.addEventListener('ended', stopShare);
      state.sharing = true; await replaceAll('video', screenTrack); showLocal(); refresh(); publish();
    }
    async function stopShare() {
      if (!screenTrack) return;
      screenTrack.removeEventListener('ended', stopShare); screenTrack.stop(); screenTrack = null; state.sharing = false;
      await replaceAll('video', state.video ? camOut() : null); showLocal(); refresh(); publish();
    }

    // ---- connections ----
    function connect(info, initiator) {
      if (peers.has(info.id)) return peers.get(info.id);
      const pc = new RTCPeerConnection({ iceServers: join.ice_servers || [] });
      const t = tile(info.id, info.name, false), stream = new MediaStream();
      t.video.srcObject = stream;
      const p = { info, pc, tile: t, pending: [], initiator, restarted: false, stream };
      peers.set(info.id, p);
      pc.onicecandidate = (e) => { if (e.candidate) send(info.id, { kind: 'candidate', candidate: e.candidate.toJSON() }); };
      pc.ontrack = (e) => { if (!stream.getTracks().includes(e.track)) stream.addTrack(e.track); t.video.play?.().catch(() => {}); };
      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        paint(t, p.info, s === 'connected' ? '' : s === 'failed' ? 'Could not connect' : s === 'disconnected' ? 'Reconnecting' : 'Connecting');
        if (s === 'failed' && p.initiator && !p.restarted) { p.restarted = true; offer(p, true); }
      };
      paint(t, info, 'Connecting');
      if (initiator) {
        pc.addTransceiver('audio', { direction: 'sendrecv' }).sender.replaceTrack(micTrack);
        pc.addTransceiver('video', { direction: 'sendrecv' }).sender.replaceTrack(videoOut());
        offer(p, false);
      }
      refresh();
      return p;
    }
    async function offer(p, iceRestart) {
      try { const o = await p.pc.createOffer({ iceRestart }); await p.pc.setLocalDescription(o); send(p.info.id, { kind: 'offer', sdp: o.sdp }); }
      catch (e) { console.warn('[call] offer failed', e.message); }
    }
    async function onSignal(from, data) {
      let p = peers.get(from);
      if (!p) return; // a message from someone who already left
      try {
        if (data.kind === 'offer') {
          await p.pc.setRemoteDescription({ type: 'offer', sdp: data.sdp });
          for (const t of p.pc.getTransceivers()) {
            t.direction = 'sendrecv';
            const kind = t.receiver.track?.kind;
            await t.sender.replaceTrack(kind === 'audio' ? micTrack : kind === 'video' ? videoOut() : null);
          }
          const a = await p.pc.createAnswer(); await p.pc.setLocalDescription(a); send(from, { kind: 'answer', sdp: a.sdp });
        } else if (data.kind === 'answer') {
          await p.pc.setRemoteDescription({ type: 'answer', sdp: data.sdp });
        } else if (data.kind === 'candidate' && data.candidate) {
          if (p.pc.remoteDescription) await p.pc.addIceCandidate(data.candidate); else p.pending.push(data.candidate);
          return;
        }
        for (const c of p.pending.splice(0)) await p.pc.addIceCandidate(c).catch(() => {});
      } catch (e) { console.warn('[call] signal failed', data.kind, e.message); }
    }
    function drop(id) {
      const p = peers.get(id); if (!p) return;
      p.pc.onconnectionstatechange = null; p.pc.close(); p.tile.node.remove(); peers.delete(id); refresh();
    }

    function handle(m) {
      if (m.type === 'peer-joined') { connect(m.peer, false); say(m.peer.name + ' joined.'); }
      else if (m.type === 'peer-left') { const p = peers.get(m.id); if (p) say(p.info.name + ' left.'); drop(m.id); }
      else if (m.type === 'peer-state') { const p = peers.get(m.peer.id); if (p) { p.info = m.peer; paint(p.tile, p.info, p.pc.connectionState === 'connected' ? '' : 'Connecting'); } }
      else if (m.type === 'signal') onSignal(m.from, m.data);
      else if (m.type === 'waiting') { waitingNow = m.waiting || []; drawWaiting(); }
      else if (m.type === 'ended') close('ended');
      else if (m.type === 'transcription') setTranscribing(Boolean(m.on), m.by);
      else if (m.type === 'caption' && m.line) addLine(m.line);
    }
    async function poll() {
      while (!closed) {
        try {
          const r = await call('poll');
          if (r.status === 410) return close('gone');
          if (!r.ok) throw new Error('poll ' + r.status);
          pollFailures = 0;
          for (const m of (await r.json()).messages || []) { if (closed) break; handle(m); }
        } catch {
          if (closed) return;
          if (++pollFailures >= 6) return close('lost');
          say('Connection to the server was interrupted. Trying again.', true);
          await new Promise((res) => setTimeout(res, Math.min(8000, 1000 * pollFailures)));
        }
      }
    }
    function close(reason) {
      if (closed) return; closed = true;
      if (reason === 'left') call('leave', { method: 'POST', body: '{}', keepalive: true }).catch(() => {});
      for (const id of [...peers.keys()]) drop(id);
      for (const t of [micTrack, cameraTrack, screenTrack]) t?.stop(); effect?.stop();
      window.removeEventListener('pagehide', onHide);
      recogWanted = false; if (recog) { try { recog.abort(); } catch { /* stopped */ } recog = null; }
      document.removeEventListener('fullscreenchange', onFs); document.removeEventListener('webkitfullscreenchange', onFs);
      if (inFs()) (document.exitFullscreen || document.webkitExitFullscreen)?.call(document)?.catch?.(() => {});
      const text = { left: 'You left the call.', ended: 'The organiser ended this meeting.', gone: 'You are no longer in this call. Join again to continue.', lost: 'The connection to the server was lost. Join again to continue.' }[reason] || 'The call has ended.';
      mount.replaceChildren(el('div', { class: 'mc-root mc-finished' }, el('p', { class: 'mc-status', role: 'status', text })));
      onClose(reason, text);
    }
    const onHide = () => { if (!closed) call('leave', { method: 'POST', body: '{}', keepalive: true }).catch(() => {}); };
    window.addEventListener('pagehide', onHide);

    (async () => {
      refresh(); drawWaiting(); if (transcribing) setTranscribing(true, null);
      if (!navigator.mediaDevices?.getUserMedia || !window.RTCPeerConnection) { say('This browser cannot make calls. Use a current version of Chrome, Edge, Safari or Firefox.', true); return; }
      say('Asking for your microphone' + (voiceOnly ? '.' : ' and camera.'));
      await setMic(true);
      if (!voiceOnly) await setCamera(true);
      if (closed) return;
      say(state.audio ? '' : 'You joined without a microphone. Others cannot hear you.', !state.audio);
      // Offer to everyone already here; people who arrive later will offer to us.
      for (const info of join.peers || []) connect(info, true);
      refresh(); publish(); poll();
    })();

    return { close: () => close('left'), isClosed: () => closed };
  }
  window.SuperProCall = { start };
})();
