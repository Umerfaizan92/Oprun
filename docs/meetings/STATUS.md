# Video and voice meetings — status, 10 November 2026 (T-074)

Built into the workspace at Communications → Video Meetings (`#b04/meetings`). No outside video provider is used.

## How it works

| Part | Where | Notes |
|---|---|---|
| Rooms, sign-in checks, guest waiting room, call set-up messages | `src/meetings.js` | Live call state is held in memory on the one application instance. Meetings and attendance are stored in `meetings` and `meeting_attendance`. |
| Sound and picture | Directly between the participants' browsers (WebRTC) | Nothing is recorded, stored or relayed by Super Pro. |
| Call screen | `saas/meet-call.js`, `saas/meetings.css` | Microphone, camera, screen share, leave; organisers also let guests in, copy the guest link and end for everyone. |
| Workspace page | `saas/workspace-meetings.js` | Call now (video or voice, tells the team), create for later, guest link, join, end, history. |
| Guest page | `saas/meet.html`, `saas/meet-guest.js` | Opened from the private link. The link's key sits after `#`, so it is not sent in page requests or written to logs. |

## Rules enforced by the server

- A meeting belongs to one workspace. Members of another workspace cannot see, join, manage or signal into it.
- A guest needs the private link and must be let in by the organiser or a manager. A guest gets no call key before that.
- A wrong link, a turned-off link and an unknown meeting give the same answer.
- Replacing the guest link stops the old one. The key is derived on the server and never stored.
- Up to 6 people per call. The same person joining again replaces their earlier place.
- People who stop responding for 45 seconds are removed. Ending a meeting removes everyone.

## Limits to know

- **Networks that block direct calls.** Browsers find each other with a public address-discovery (STUN) server. On some
  office and mobile networks a direct path is impossible and the call will not connect for that person. A relay (TURN)
  fixes this; it needs an account with a relay provider and three settings: `MEETING_TURN_URLS`,
  `MEETING_TURN_USERNAME`, `MEETING_TURN_CREDENTIAL`. Not configured today.
- **Restart.** A deploy or restart ends calls in progress. People rejoin from the same page or link.
- **Size.** Calls are browser-to-browser, so quality drops beyond about 6 people. Larger meetings need a media server.
- **Not built:** recording, chat inside the call, calendar invitations, sending the guest link by email or SMS from the
  page, calling ordinary phone numbers (that is the separate Calls & SMS feature).
- **Phones.** Screen sharing is offered only where the browser supports it.

## Tests

- `scripts/meetings.test.mjs`: isolation, guest waiting room, signalling, link replacement, ending, room size, rejoin, timeouts.
- `scripts/test-meetings-ui.mjs`: real browsers with a test camera and microphone; an owner and two guests see and
  hear each other; waiting room, decline, mute and camera states, leave, end for everyone; phone, tablet, laptop widths;
  accessibility check.
- Not tested: a call across two real networks on production. That needs two people on different connections.
