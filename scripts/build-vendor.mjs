// T-184: copies the MediaPipe selfie segmentation runtime (Apache-2.0) into saas/vendor so meeting background effects
// load from Oprun itself, with no third-party CDN at call time. Run: npm run build:vendor
import fs from 'node:fs';
const from = new URL('../node_modules/@mediapipe/selfie_segmentation/', import.meta.url);
const to = new URL('../saas/vendor/mediapipe/selfie_segmentation/', import.meta.url);
fs.mkdirSync(to, { recursive: true });
for (const f of fs.readdirSync(from)) if (/\.(js|wasm|tflite|binarypb|data)$/.test(f) && f !== 'index.d.ts') fs.copyFileSync(new URL(f, from), new URL(f, to));
fs.writeFileSync(new URL('LICENSE.txt', to), 'MediaPipe Selfie Segmentation, Copyright Google LLC. Licensed under the Apache License, Version 2.0: https://www.apache.org/licenses/LICENSE-2.0\n');
console.log('vendor:', fs.readdirSync(to).join(', '));
