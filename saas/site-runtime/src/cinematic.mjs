// W-06: the cinematic hero island for business websites (docs/ai-website/00_CONTRACT.md D-W3).
// Four line-art presets in the business's brand colour. Each plays once, for under four seconds, then rendering stops
// on its final frame. No loop, no pointer tracking, nothing the visitor has to wait for: the poster is already on screen.
// Built with `npm run build:ds` (esbuild tree-shakes Three.js into saas/site-runtime/cinematic.js).
import {
  Scene, PerspectiveCamera, WebGLRenderer, Color, Group, BoxGeometry, EdgesGeometry, LineSegments, LineBasicMaterial,
  BufferGeometry, Float32BufferAttribute, TorusGeometry, CylinderGeometry
} from 'three';

export const DURATION_MS = 3600;
const ease = (t) => 1 - (1 - Math.min(Math.max(t, 0), 1)) ** 3;
const edges = (geo, mat) => new LineSegments(new EdgesGeometry(geo), mat);
const lines = (pts, mat) => { const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(pts, 3)); return new LineSegments(g, mat); };

// Each preset builds its objects and returns update(t), t from 0 to 1 over the whole play.
const PRESETS = {
  // A floor-plan grid draws in, then a house outline rises from it.
  blueprint(world, m) {
    const grid = [];
    for (let i = -6; i <= 6; i++) grid.push(i, 0, -6, i, 0, 6, -6, 0, i, 6, 0, i);
    const g = lines(grid, m.faint); world.add(g);
    const house = new Group();
    const body = edges(new BoxGeometry(4, 2.4, 3), m.main); body.position.y = 1.2; house.add(body);
    const roof = edges(new CylinderGeometry(0, 3, 1.6, 4, 1), m.main); roof.position.y = 3.2; roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.75); house.add(roof);
    world.add(house);
    return (t) => { g.scale.setScalar(0.2 + 0.8 * ease(t / 0.4)); house.scale.y = Math.max(0.001, ease((t - 0.3) / 0.6)); world.rotation.y = -0.6 + 0.5 * ease(t); };
  },
  // Building materials drop into a neat stack, one after another.
  materials(world, m) {
    const pieces = [];
    for (let row = 0; row < 4; row++) for (let i = 0; i < 3; i++) {
      const p = edges(new BoxGeometry(1.8, 0.5, 0.9), row % 2 ? m.faint : m.main);
      p.userData = { x: (i - 1) * 1.9 + (row % 2 ? 0.95 : 0), y: 0.25 + row * 0.52, start: (row * 3 + i) / 16 };
      p.position.set(p.userData.x, 8, 0); world.add(p); pieces.push(p);
    }
    return (t) => { for (const p of pieces) p.position.y = p.userData.y + (1 - ease((t - p.userData.start) / 0.25)) * 7; world.rotation.y = -0.4 + 0.3 * ease(t); };
  },
  // A row of buildings rises from the ground, tallest last.
  skyline(world, m) {
    const towers = [1.6, 2.6, 1.2, 3.6, 2.0, 2.8, 1.4].map((h, i) => {
      const b = edges(new BoxGeometry(0.9, h, 0.9), i === 3 ? m.main : m.faint); b.userData = { h, start: i / 10 };
      b.position.set((i - 3) * 1.1, 0, 0); world.add(b); return b;
    });
    world.add(lines([-5, 0, 0, 5, 0, 0], m.main));
    return (t) => { for (const b of towers) { const k = Math.max(0.001, ease((t - b.userData.start) / 0.45)); b.scale.y = k; b.position.y = (b.userData.h * k) / 2; } world.rotation.y = -0.35 + 0.25 * ease(t); };
  },
  // Two gears turn together and settle.
  tools(world, m) {
    const gear = (r, teeth, mat) => { const g = new Group(); g.add(edges(new TorusGeometry(r, 0.18, 6, teeth * 2), mat)); for (let i = 0; i < teeth; i++) { const tooth = edges(new BoxGeometry(0.35, 0.4, 0.3), mat); const a = (i / teeth) * Math.PI * 2; tooth.position.set(Math.cos(a) * (r + 0.3), Math.sin(a) * (r + 0.3), 0); tooth.rotation.z = a; g.add(tooth); } return g; };
    const a = gear(1.6, 12, m.main), b = gear(1.0, 8, m.faint); a.position.x = -1.1; b.position.set(1.75, 0.6, 0); world.add(a, b);
    return (t) => { const turn = ease(t) * Math.PI * 1.2; a.rotation.z = turn; b.rotation.z = -turn * 1.5 + 0.2; world.rotation.y = -0.3 + 0.3 * ease(t); };
  }
};
export const PRESET_NAMES = Object.keys(PRESETS);

export function mount(el, { preset = 'blueprint', color = '#1f4e79', quality = 'high', duration = DURATION_MS } = {}) {
  const host = el.querySelector('.poster') || el.appendChild(Object.assign(document.createElement('div'), { className: 'cine-stage' }));
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'cine-canvas';
  let renderer;
  try { renderer = new WebGLRenderer({ canvas, antialias: quality === 'high', alpha: true, powerPreference: 'low-power' }); } catch { el.dataset.cinematicState = 'poster'; return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 1.75 : 1));
  renderer.setClearColor(0x000000, 0);
  host.append(canvas);
  const main = new Color(/^#[0-9a-f]{6}$/i.test(color || '') ? color : '#1f4e79');
  const m = { main: new LineBasicMaterial({ color: main }), faint: new LineBasicMaterial({ color: main, transparent: true, opacity: 0.45 }) };
  const scene = new Scene(), world = new Group(); scene.add(world);
  const camera = new PerspectiveCamera(35, 1, 0.1, 100); camera.position.set(0, 4.5, 14); camera.lookAt(0, 1.4, 0);
  const update = (PRESETS[preset] || PRESETS.blueprint)(world, m);
  const size = () => { const w = host.clientWidth || 600, h = host.clientHeight || 300; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  size();
  let start = 0, frames = 0;
  const finish = () => { renderer.setAnimationLoop(null); update(1); renderer.render(scene, camera); el.dataset.cinematicState = 'done'; el.dataset.cinematicFrames = String(frames); };
  const onResize = () => { size(); if (el.dataset.cinematicState === 'done') renderer.render(scene, camera); };
  addEventListener('resize', onResize);
  el.dataset.cinematicState = 'playing';
  renderer.setAnimationLoop((now) => {
    if (!start) start = now;
    const t = (now - start) / duration; frames++;
    if (t >= 1 || document.hidden) return finish();
    update(t); renderer.render(scene, camera);
  });
  return { finish };
}
