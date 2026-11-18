export function resendOutboundKey(env) {
  return String(env.RESEND_OUTBOUND_API_KEY || '').trim() || env.RESEND_API_KEY;
}
