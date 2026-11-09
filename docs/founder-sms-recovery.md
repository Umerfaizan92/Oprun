# Temporary Founder SMS recovery

This change preserves existing accounts, verification flags, passwords, authenticator MFA, subscriptions and application settings. It adds two recovery tables. Public registration and other accounts retain their existing authentication requirements.

## Configuration and activation

Set `SMS_VERIFICATION_ENABLED=false` on the production service. This exact value permits email-only verification **only** for the existing linked Founder account with a current administrative recovery approval. Unset, invalid or `true` values require SMS in the recovery flow. The flag is server-side; browser state cannot grant eligibility.

1. Open `/saas/founder-recovery.html`, also linked from Operator sign-in.
2. Authenticate with the Founder admin key and current authenticator code. A raw key, business session or platform staff session cannot approve recovery.
3. Review the server-selected linked Founder account, enter a reason and confirm. Approval lasts 24 hours and revokes that account's current business sessions and previous recovery challenges. No email address can establish a Founder link through this procedure. If no Founder link exists, stop and independently establish account identity through the existing administrative process.
4. Use Business sign-in with the account password and its authenticator code if enabled. Complete the fresh six-digit email OTP. No session is issued before successful OTP verification.

SMS input and resend controls are hidden only after the server confirms an approved, browser-bound email-only challenge. Email delivery uses the existing verification mail transport. Codes expire after 10 minutes; Telnyx challenges may expire sooner. Eight verification attempts, existing endpoint rate limits, append-only audit logging, single-use challenges and HttpOnly cookies remain enabled. Resends do not reset expiry or attempts. No test codes are returned by these endpoints, including outside production.

## Restore SMS

Set `SMS_VERIFICATION_ENABLED=true` and deploy. All in-flight email-only recovery challenges then fail closed. Sign in again to obtain a new challenge requiring email and SMS. Existing phone/email verification flags and authenticator settings were never altered. Recovery approvals also expire automatically after 24 hours; deleting an approval through an authenticated operational procedure immediately invalidates its pending challenges.

## Validation

- `node --test scripts/founder-verification.test.mjs scripts/founder-recovery-runtime.test.mjs`
- `npm test`
- Verify the verification interface with both server responses (`sms_required: false` and `true`), including required/disabled states and SMS resend visibility.

Tests use temporary databases and synthetic accounts. The runtime test verifies real login password and admin authenticator checks, successful email OTP before session creation, replay rejection and unchanged phone verification state. It never reads production credentials or sends real messages.

Production activation still requires the authenticated Founder recovery approval. Deploying the flag alone grants no account access. Confirm real email delivery during the account owner's recovery; synthetic tests cannot prove production mail delivery.
