// Stable user-facing errors. Never forward arbitrary provider bodies (they may
// echo credentials, request URLs, prompts or account data).
export function mediaProviderError(provider, upstreamStatus, { credentialCheck = false } = {}) {
  const label = { google: 'Google', runway: 'Runway', elevenlabs: 'ElevenLabs' }[provider] || 'The provider';
  let code = 'PROVIDER_REJECTED', status = 502, action = 'review_settings', message = `${label} did not accept this request. Review the model and settings.`;
  if (upstreamStatus === 402) { code = 'BILLING_REQUIRED'; status = 402; action = 'billing'; message = `${label} needs billing attention. Check the connected account's credits and billing. Your prompt and existing footage are kept.`; }
  else if (upstreamStatus === 429) { code = 'QUOTA_EXCEEDED'; status = 429; action = 'wait'; message = `${label} has reached a rate or usage limit. Wait or review your account quota before trying again.`; }
  else if ([401, 403].includes(upstreamStatus) || credentialCheck && upstreamStatus === 400) { code = 'AUTH_RECONNECT'; status = credentialCheck ? 400 : 403; action = 'reconnect'; message = `${label} did not accept this key or its permissions. Ask the owner or admin to check the connected account.`; }
  else if (upstreamStatus === 400 || upstreamStatus === 422) { code = 'INVALID_INPUT'; status = 400; message = `${label} did not accept these video settings. Review the prompt, attachments and supported model options.`; }
  else if (upstreamStatus >= 500) { code = 'PROVIDER_UNAVAILABLE'; status = 503; action = 'wait'; message = `${label} is unavailable right now. Your project is kept. Try again later.`; }
  return Object.assign(new Error(message), { code, status, action, provider, upstreamStatus });
}
