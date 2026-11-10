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
  function start({ mount, join, host = null, waiting = [], onClose = () => {} }) {
    const secret = join.peer_secret, selfId = join.peer_id, voiceOnly = join.meeting.mode === 'voice';
    const peers = new Map(); // id -> { info, pc, tile, pending: [], initiator, restarted }
    let localStream = new MediaStream(), cameraTrack = null, micTrack = null, screenTrack = null, closed = false, pollFailures = 0, waitingNow = waiting;
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
    const endBtn = host ? el('button', { type: 'button', class: 'mc-btn mc-end', text: 'End for everyone', onclick: async () => { if (!confirm('End this meeting for everyone?')) return; endBtn.disabled = true; try { await host.end(); } catch (e) { say(e.message, true); endBtn.disabled = false; } } }) : null;
    const copyBtn = host?.guestLink ? el('button', { type: 'button', class: 'mc-btn', text: 'Copy guest link', onclick: async () => { try { await navigator.clipboard.writeText(host.guestLink); say('Guest link copied. Guests wait until you let them in.'); } catch { say('Copy is blocked in this browser. Use Video Meetings to copy the link.', true); } } }) : null;
    const root = el('div', { class: 'mc-root', role: 'group', 'aria-label': 'Call: ' + join.meeting.title },
      el('header', { class: 'mc-head' }, el('h2', { text: join.meeting.title }), count),
      status, waitBox, grid,
      el('div', { class: 'mc-controls', role: 'toolbar', 'aria-label': 'Call controls' }, micBtn, camBtn, shareBtn, copyBtn, endBtn, leaveBtn),
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
    const videoOut = () => screenTrack || (state.video ? cameraTrack : null);
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
      state.audio = Boolean(on && micTrack); showLocal(); refresh(); publish();
    }
    async function setCamera(on) {
      if (on && !cameraTrack) {
        try { cameraTrack = (await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 960 }, height: { ideal: 540 } } })).getVideoTracks()[0]; }
        catch { say('The camera is not available. Allow it in your browser settings, then try again.', true); return; }
      }
      if (cameraTrack) cameraTrack.enabled = on;
      state.video = Boolean(on && cameraTrack);
      if (!screenTrack) await replaceAll('video', state.video ? cameraTrack : null);
      showLocal(); refresh(); publish();
    }
    async function startShare() {
      try { screenTrack = (await navigator.mediaDevices.getDisplayMedia({ video: true })).getVideoTracks()[0]; } catch { return; }
      screenTrack.addEventListener('ended', stopShare);
      state.sharing = true; await replaceAll('video', screenTrack); showLocal(); refresh(); publish();
    }
    async function stopShare() {
      if (!screenTrack) return;
      screenTrack.removeEventListener('ended', stopShare); screenTrack.stop(); screenTrack = null; state.sharing = false;
      await replaceAll('video', state.video ? cameraTrack : null); showLocal(); refresh(); publish();
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
      for (const t of [micTrack, cameraTrack, screenTrack]) t?.stop();
      window.removeEventListener('pagehide', onHide);
      const text = { left: 'You left the call.', ended: 'The organiser ended this meeting.', gone: 'You are no longer in this call. Join again to continue.', lost: 'The connection to the server was lost. Join again to continue.' }[reason] || 'The call has ended.';
      mount.replaceChildren(el('div', { class: 'mc-root mc-finished' }, el('p', { class: 'mc-status', role: 'status', text })));
      onClose(reason, text);
    }
    const onHide = () => { if (!closed) call('leave', { method: 'POST', body: '{}', keepalive: true }).catch(() => {}); };
    window.addEventListener('pagehide', onHide);

    (async () => {
      refresh(); drawWaiting();
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
