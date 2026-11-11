# Oprun mobile release preparation

This directory contains real Android and iOS build projects, not published store
listings. Passing compilation is not store approval. Do not describe unsigned or
simulator artifacts as upload-ready releases.

## Android

The Android app uses Google's Android Browser Helper 2.7.4 and a Trusted Web
Activity. It opens the authenticated workspace in the browser engine, preserving
normal web sessions, file selection and provider consent flows. It does not
embed API keys or relax server authentication, CORS or TLS.

Prerequisites: JDK 17, Android SDK 36, Gradle 8.13. From `mobile/android`:

```
gradle :app:assembleDebug :app:bundleRelease :app:lintRelease
```

The default release bundle is **unsigned**. To sign for release, provide
`OPRUN_KEYSTORE_PATH`, `OPRUN_KEYSTORE_PASSWORD`, `OPRUN_KEY_ALIAS`, and
`OPRUN_KEY_PASSWORD` through a secret-managed environment. Keep the keystore out
of Git. Enrol the app in Play App Signing and retain a secure upload-key backup.

Set `ANDROID_APP_ID=ai.oprun.app` and `ANDROID_CERT_SHA256` on the server to the
actual **Play app signing** SHA-256 certificate fingerprint (comma-separated for
key rotation). The public endpoint is `/.well-known/assetlinks.json`. It serves
an empty list until real, syntactically valid fingerprints are supplied. A
debug APK has a different certificate; without matching Digital Asset Links,
Chrome should show its browser toolbar rather than trusted full-screen mode.

## iOS / iPadOS

The SwiftUI app uses WKWebView with native back navigation, refresh,
pull-to-refresh, connection recovery, a help entry and system sharing of the
public Oprun homepage. It uses normal WebKit cookies; credentials are not
copied into JavaScript storage. Camera/microphone requests from Oprun prompt the
user rather than being automatically granted. Other origins cannot replace the
workspace. External account connections may require completing setup in Safari.

On a Mac with Xcode and XcodeGen:

```
cd mobile/ios
xcodegen generate
xcodebuild -project Oprun.xcodeproj -scheme Oprun -sdk iphonesimulator \
  -configuration Release -derivedDataPath build CODE_SIGNING_ALLOWED=NO build
```

For a device archive, choose your Apple developer team in Xcode, confirm bundle
ID `ai.oprun.app`, configure signing, and use Product > Archive. Upload through
Organizer to App Store Connect/TestFlight. The generated `.xcodeproj` is
reproducible from `project.yml` and is not checked in.

For universal links, set `APPLE_TEAM_ID` to your real ten-character team ID and
`APPLE_BUNDLE_ID=ai.oprun.app` on the server. Verify the public
`/.well-known/apple-app-site-association` response and associated-domain
entitlement on a signed device. With no team configured, no association is
claimed. Never commit signing certificates, profiles, private keys or tokens.

## Release gates — still required from the owner

1. Active Google Play and Apple developer accounts, verified legal publisher
   identity, final package IDs and signing credentials.
2. Real-device tests: cold start, upgrade, sign-in, email/mobile OTP, MFA,
   logout, account recovery, owner/worker access, file uploads, meetings,
   microphone/camera denial and grant, provider consent/reconnect, foreground/
   background transitions, weak networks, and account deletion.
3. Configure and verify the two domain-association files with the actual signing
   identity. A passing unsigned/simulator build does not complete this step.
4. Review subscription purchasing and links in the mobile workspace against
   current Apple/Google rules and applicable business-app exceptions. Do not
   assume web checkout is allowed merely because the product is SaaS. No billing
   exemptions or store purchase integration are claimed by these projects.
5. Review WKWebView external navigation and provider-specific OAuth on iOS.
   Google and other providers can disallow embedded authentication. The native
   More menu offers Safari for managing connections. Do not claim all social
   connections are device-tested until they actually are.
6. App Store minimum-functionality review: demonstrate the actual authenticated
   jobs, inbox, approvals and field-work features with reviewer access. Native
   navigation alone does not guarantee acceptance of a web-based app.
7. Complete Data Safety/App Privacy declarations from the **entire service**,
   including its web backend and third-party providers. The native privacy
   manifest describes only the shell; empty native data/API lists do not mean
   Oprun collects no business data. Check SDK changes for required API reasons.
8. Provide review access without weakening production MFA. Use a dedicated
   isolated review tenant and an approved, review-compatible authentication
   method. No bypass or shared production account is created here.
9. Supply real-device screenshots, app descriptions, support/privacy URLs,
   public account-deletion instructions, age/content ratings, and any required
   closed testing. Complete account deletion end to end in staging.

## Release URLs

The installation and account-deletion pages are part of this candidate and are
not live until it is deployed.

- Website: https://www.oprun.ai/
- Installation: https://www.oprun.ai/install
- Account-deletion instructions: https://www.oprun.ai/account-deletion
- Support: https://www.oprun.ai/contact
- Privacy: https://www.oprun.ai/saas/privacy.html
- Terms: https://www.oprun.ai/saas/terms.html

The `Mobile build validation` GitHub workflow compiles an Android debug APK,
unsigned Android release AAB, and unsigned iOS simulator app. It **never**
publishes to either store. Device signing and store uploads are separate steps.
