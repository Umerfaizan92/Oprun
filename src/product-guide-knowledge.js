// Verified public guidance also works when an AI provider is unavailable.
// These descriptions are capabilities, not assertions that a tenant is connected.
export function publicProductAnswer(question, language = 'en') {
  if (language !== 'en') return null;
  const q = String(question || '').toLowerCase().split('verified product context:')[0];
  if (/miss(?:ed)? (?:a |my )?calls?|cannot answer|can't answer/.test(q)) {
    return 'With the receptionist add-on configured and active, Oprun can answer an incoming call, collect the caller’s details and create an enquiry. A reply can then be drafted for you to review. It is sent only after the required approval. Call handling depends on your connected number, provider setup and available usage.';
  }
  if (/approv|automatic(?:ally)? send|send.*without asking/.test(q)) {
    return 'Oprun prepares a draft or proposed action, then waits for an authorised person to review it. You can check and edit the draft before approving it. External actions must pass the workspace’s approval rules and server-side permissions before they execute; the public approval demo does not send a real message.';
  }
  if (/(?:worker|staff|employee).*(?:pric|financ|money)|(?:pric|financ).*(?:worker|staff|employee)/.test(q)) {
    return 'Standard workers see their assigned operational work rather than private pricing or company financials. Owners manage access through People and permissions. Financial access must be checked on the server for each request; hiding a screen alone is not sufficient.';
  }
  if (/install|home screen|android|iphone|app store|play store/.test(q)) {
    return 'You can install Oprun from a supported browser using the Install Oprun page. On iPhone or iPad, open Oprun in Safari and use Share, Add to Home Screen, then Add. Android Chrome and supported desktop browsers may offer an Install app option. Store apps are a separate release; a PWA installation does not mean an App Store or Google Play listing is available.';
  }
  return null;
}
