/* Star Learner 3D — three.js scenes for the home island, 3D Shapes, Where Is It?, Count & Drop,
   and the treasure-chest celebration. One shared WebGL renderer is moved between hosts; a view only
   renders while its host is on screen. Everything is built from primitives (no downloads). */
import * as THREE from 'three';

/* ---------- shared renderer + loop ---------- */
const COL = { coral: 0xff5d73, blue: 0x3a57e8, green: 0x22b573, orange: 0xff9f1c, purple: 0x9b5de5, cyan: 0x00b4d8, yellow: 0xffd23f, pink: 0xff8fab, brown: 0x9c6b3f, white: 0xffffff };
const PALETTE = [COL.coral, COL.blue, COL.green, COL.orange, COL.purple, COL.cyan];
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
let renderer = null, active = null, last = 0, chestView = null;
const tweens = [];

function getRenderer() {
  if (renderer) return renderer;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:inherit';
  bindPointer(renderer.domElement);
  requestAnimationFrame(loop);
  return renderer;
}
function visible(host) { return host && host.isConnected && host.offsetParent !== null && host.clientWidth > 0; }
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t;
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i]; tw.t += dt;
    const k = Math.min(1, tw.t / tw.d); tw.fn(k);
    if (k >= 1) { tweens.splice(i, 1); tw.done && tw.done(); }
  }
  const v = active;
  if (!v || !visible(v.host)) return;
  if (v.host !== renderer.domElement.parentNode) v.host.appendChild(renderer.domElement);
  const w = v.host.clientWidth, h = v.host.clientHeight;
  if (v._w !== w || v._h !== h) {
    v._w = w; v._h = h; renderer.setSize(w, h, false);
    v.camera.aspect = w / h; v.fit && v.fit(w / h); v.camera.updateProjectionMatrix();
  }
  v.update && v.update(dt, t / 1000);
  renderer.render(v.scene, v.camera);
}
function tween(d, fn, done) { if (reduced()) { fn(1); done && done(); return; } tweens.push({ t: 0, d, fn, done }); }
const ease = k => 1 - Math.pow(1 - k, 3);

function mount(view) {
  const r = getRenderer();
  if (active && active !== view && !active.keep) disposeView(active);
  active = view;
  try { if (window.__SL_QA) window.__SL_QA.view = view; } catch (e) {}
  view.host.appendChild(r.domElement);
  view._w = 0;
}
function disposeView(v) {
  v.scene.traverse(o => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); if (!m.userData.shared) m.dispose(); });
  });
}

/* ---------- pointer: tap vs drag ---------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function bindPointer(el) {
  let down = null;
  el.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, lx: e.clientX, moved: 0 }; try { el.setPointerCapture(e.pointerId); } catch (_) {} });
  el.addEventListener('pointermove', e => {
    if (!down || !active) return;
    const dx = e.clientX - down.lx; down.lx = e.clientX;
    down.moved = Math.max(down.moved, Math.hypot(e.clientX - down.x, e.clientY - down.y));
    if (down.moved > 8 && active.drag) active.drag(dx / el.clientWidth);
  });
  el.addEventListener('pointerup', e => {
    if (!down || !active) { down = null; return; }
    const moved = down.moved; down = null;
    if (moved > 10 || !active.tap) return;
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, active.camera);
    const hits = ray.intersectObjects(active.pickables || [], true);
    for (const h of hits) { let o = h.object; while (o && !o.userData.pick) o = o.parent; if (o) { active.tap(o); return; } }
  });
  el.addEventListener('pointercancel', () => { down = null; });
}

/* ---------- building blocks ---------- */
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.05, ...o });
function mesh(geo, m, { x = 0, y = 0, z = 0, cast = true, recv = false } = {}) {
  const me = new THREE.Mesh(geo, typeof m === 'number' ? mat(m) : m);
  me.position.set(x, y, z); me.castShadow = cast; me.receiveShadow = recv; return me;
}
function baseScene({ sky = false } = {}) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x9bc58a, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(4, 9, 6); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  if (sky) scene.fog = new THREE.Fog(0xcfeeff, 18, 40);
  return scene;
}
function textTex(txt, bg = '#ffffff', fg = '#22306e', size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, size, size);
  g.fillStyle = fg; g.font = `bold ${size * 0.62}px system-ui, -apple-system, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, size / 2, size / 2 + size * 0.04);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function letterBlock(ch, color, s = 0.55) {
  const tex = textTex(ch, '#' + new THREE.Color(color).getHexString(), '#ffffff');
  return mesh(new THREE.BoxGeometry(s, s, s), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
}
let starGeo = null;
function starGeometry() {
  if (starGeo) return starGeo;
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.2 : 0.45, a = i / 10 * Math.PI * 2 + Math.PI / 2;
    i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  starGeo = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 2 });
  starGeo.center(); starGeo.userData.shared = true;
  return starGeo;
}
const goldMat = () => mat(0xffc93c, { metalness: 0.35, roughness: 0.3, emissive: 0x5a3c00, emissiveIntensity: 0.25 });
function star(scale = 1) { const m = mesh(starGeometry(), goldMat()); m.scale.setScalar(scale); return m; }

function teddy(color) {
  const g = new THREE.Group(), m = mat(color), light = mat(0xfff1dc), dark = mat(0x2b1d14);
  g.add(mesh(new THREE.SphereGeometry(0.42, 24, 16), m, { y: 0.42 }));
  g.add(mesh(new THREE.SphereGeometry(0.32, 24, 16), m, { y: 1.02 }));
  [-0.22, 0.22].forEach(x => g.add(mesh(new THREE.SphereGeometry(0.12, 16, 12), m, { x, y: 1.28 })));
  g.add(mesh(new THREE.SphereGeometry(0.13, 16, 12), light, { y: 0.96, z: 0.27 }));
  g.add(mesh(new THREE.SphereGeometry(0.045, 10, 8), dark, { y: 1.0, z: 0.39 }));
  [-0.11, 0.11].forEach(x => g.add(mesh(new THREE.SphereGeometry(0.04, 10, 8), dark, { x, y: 1.1, z: 0.28 })));
  [-0.36, 0.36].forEach(x => g.add(mesh(new THREE.SphereGeometry(0.13, 14, 10), m, { x, y: 0.55, z: 0.12 })));
  [-0.2, 0.2].forEach(x => g.add(mesh(new THREE.SphereGeometry(0.15, 14, 10), m, { x, y: 0.1, z: 0.2 })));
  g.add(mesh(new THREE.SphereGeometry(0.2, 16, 12), light, { y: 0.42, z: 0.27 }));
  return g;
}
function fruit(kind) {
  const g = new THREE.Group();
  if (kind === 'apples') {
    g.add(mesh(new THREE.SphereGeometry(0.28, 20, 14), COL.coral, { y: 0.28 }));
    g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.16), 0x5b3a1e, { y: 0.6 }));
    const leaf = mesh(new THREE.SphereGeometry(0.08, 10, 6), COL.green, { x: 0.08, y: 0.62 }); leaf.scale.set(1.4, 0.4, 0.8); g.add(leaf);
  } else if (kind === 'oranges') {
    g.add(mesh(new THREE.SphereGeometry(0.28, 20, 14), COL.orange, { y: 0.28 }));
    g.add(mesh(new THREE.SphereGeometry(0.05, 8, 6), COL.green, { y: 0.56 }));
  } else if (kind === 'strawberries') {
    const b = mesh(new THREE.ConeGeometry(0.26, 0.5, 18), 0xe63946, { y: 0.27 }); b.rotation.x = Math.PI; g.add(b);
    g.add(mesh(new THREE.CylinderGeometry(0.2, 0.12, 0.06, 8), COL.green, { y: 0.54 }));
  } else {
    g.add(mesh(new THREE.SphereGeometry(0.28, 20, 14), COL.blue, { y: 0.28 }));
    g.add(mesh(new THREE.TorusGeometry(0.28, 0.035, 8, 24), COL.yellow, { y: 0.28 }));
  }
  return g;
}

/* ---------- solids ---------- */
const SOLIDS = {
  cube: () => new THREE.BoxGeometry(1.25, 1.25, 1.25),
  sphere: () => new THREE.SphereGeometry(0.78, 36, 24),
  cone: () => new THREE.ConeGeometry(0.75, 1.55, 36),
  cylinder: () => new THREE.CylinderGeometry(0.62, 0.62, 1.4, 36),
  pyramid: () => new THREE.ConeGeometry(0.95, 1.4, 4),
  prism: () => new THREE.BoxGeometry(1.7, 0.85, 0.85)
};
const SOLID_NAME = { cube: 'cube', sphere: 'sphere', cone: 'cone', cylinder: 'cylinder', pyramid: 'pyramid', prism: 'rectangular prism' };
const pick = a => a[Math.floor(Math.random() * a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* ---------- island (home) ---------- */
let islandView = null;
function landmark(id) {
  const g = new THREE.Group();
  const add = (o) => (g.add(o), o);
  switch (id) {
    case 'story': [COL.coral, COL.blue, COL.green].forEach((c, i) => { const b = add(mesh(new THREE.BoxGeometry(0.9 - i * 0.08, 0.2, 0.65), c, { y: 0.1 + i * 0.21 })); b.rotation.y = i * 0.25; }); break;
    case 'facts': { const r = add(mesh(new THREE.TorusGeometry(0.34, 0.07, 12, 32), COL.purple, { y: 0.85 })); r.rotation.y = 0.4;
      add(mesh(new THREE.CircleGeometry(0.33, 28), new THREE.MeshStandardMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.6, side: THREE.DoubleSide }), { y: 0.85 })).rotation.y = 0.4;
      add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.6), COL.brown, { y: 0.3 })); break; }
    case 'spell': ['A', 'B', 'C'].forEach((ch, i) => { const b = add(letterBlock(ch, PALETTE[i])); b.position.set((i - 1) * 0.42, i === 1 ? 0.8 : 0.28, 0); b.rotation.y = (i - 1) * 0.3; }); break;
    case 'sight': [-0.22, 0.22].forEach(x => { add(mesh(new THREE.SphereGeometry(0.24, 20, 14), COL.white, { x, y: 0.7 })); add(mesh(new THREE.SphereGeometry(0.1, 12, 10), 0x22306e, { x, y: 0.7, z: 0.2 })); });
      add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5), COL.purple, { y: 0.25 })); break;
    case 'words': add(mesh(new THREE.BoxGeometry(0.9, 0.45, 0.5), COL.coral, { y: 0.23 })); add(mesh(new THREE.TorusGeometry(0.18, 0.05, 8, 20, Math.PI), 0x555555, { y: 0.46 })); break;
    case 'count': case 'count3d':
      add(mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.7), COL.brown, { y: 0.35 }));
      add(mesh(new THREE.SphereGeometry(0.5, 20, 14), 0x4caf50, { y: 1.0 }));
      [[0.3, 0.95, 0.3], [-0.25, 1.15, 0.32], [0.05, 0.75, 0.45]].forEach(([x, y, z]) => add(mesh(new THREE.SphereGeometry(0.1, 12, 8), id === 'count3d' ? COL.orange : COL.coral, { x, y, z })));
      if (id === 'count3d') add(mesh(new THREE.CylinderGeometry(0.32, 0.25, 0.25, 16, 1, true), new THREE.MeshStandardMaterial({ color: 0xc8a165, side: THREE.DoubleSide }), { x: 0.55, y: 0.13 }));
      break;
    case 'addsub': add(mesh(new THREE.BoxGeometry(0.75, 0.22, 0.22), COL.green, { y: 0.6 })); add(mesh(new THREE.BoxGeometry(0.22, 0.75, 0.22), COL.green, { y: 0.6 })); add(mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.25), 0x888888, { y: 0.12 })); break;
    case 'numbers': ['1', '2', '3'].forEach((ch, i) => { for (let k = 0; k <= i; k++) { const b = add(letterBlock(ch, PALETTE[i + 2], 0.38)); b.position.set((i - 1) * 0.4, 0.19 + k * 0.38, 0); } }); break;
    case 'shapes': { add(mesh(new THREE.ConeGeometry(0.28, 0.6, 3), COL.coral, { x: -0.3, y: 0.3 })); add(mesh(new THREE.BoxGeometry(0.4, 0.4, 0.08), COL.blue, { x: 0.25, y: 0.2 })); add(mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 24), COL.yellow, { y: 0.6, z: -0.1 })).rotation.x = Math.PI / 2; break; }
    case 'shapes3d': add(mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), COL.cyan, { x: -0.32, y: 0.23 })); add(mesh(new THREE.SphereGeometry(0.25, 20, 14), COL.coral, { x: 0.3, y: 0.25 })); add(mesh(new THREE.ConeGeometry(0.22, 0.5, 24), COL.yellow, { y: 0.7, z: -0.05 })); break;
    case 'measure': add(mesh(new THREE.BoxGeometry(0.18, 1.1, 0.18), COL.orange, { x: -0.25, y: 0.55 })); add(mesh(new THREE.BoxGeometry(0.18, 0.5, 0.18), COL.blue, { x: 0.05, y: 0.25 })); add(mesh(new THREE.BoxGeometry(0.18, 0.8, 0.18), COL.green, { x: 0.35, y: 0.4 })); break;
    case 'where3d': { const t = new THREE.Group(); t.add(mesh(new THREE.BoxGeometry(0.9, 0.08, 0.55), COL.brown, { y: 0.5 }));
      [[-0.38, -0.22], [0.38, -0.22], [-0.38, 0.22], [0.38, 0.22]].forEach(([x, z]) => t.add(mesh(new THREE.BoxGeometry(0.07, 0.5, 0.07), COL.brown, { x, y: 0.25, z })));
      g.add(t); const b = teddy(0xc68642); b.scale.setScalar(0.35); b.position.y = 0.54; g.add(b); break; }
    default: add(mesh(new THREE.SphereGeometry(0.35, 16, 12), COL.yellow, { y: 0.35 }));
  }
  return g;
}
function rocket() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.38, 0.42, 1.3, 24), COL.white, { y: 1.0 }));
  g.add(mesh(new THREE.ConeGeometry(0.38, 0.6, 24), COL.coral, { y: 1.95 }));
  { const w = mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.06, 20), COL.blue, { y: 1.25, z: 0.37 }); w.rotation.x = Math.PI / 2; g.add(w); }
  for (let i = 0; i < 3; i++) { const f = mesh(new THREE.BoxGeometry(0.06, 0.45, 0.4), COL.coral, { y: 0.55 }); const a = i / 3 * Math.PI * 2; f.position.x = Math.sin(a) * 0.42; f.position.z = Math.cos(a) * 0.42; f.rotation.y = a; g.add(f); }
  { const fl = mesh(new THREE.ConeGeometry(0.22, 0.4, 16), new THREE.MeshStandardMaterial({ color: COL.orange, emissive: COL.orange, emissiveIntensity: 0.8 }), { y: 0.2 }); fl.rotation.x = Math.PI; g.add(fl); }
  return g;
}
export function island(host, { games, stars = 0, onPick }) {
  const key = games.join(',');
  if (islandView && islandView.key === key) {
    islandView.host = host; islandView.onPick = onPick; islandView.setStars(stars); mount(islandView); return;
  }
  if (islandView) { islandView.keep = false; disposeView(islandView); }
  const scene = baseScene({ sky: true });
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  const world = new THREE.Group(); scene.add(world);
  const water = mesh(new THREE.CylinderGeometry(11, 11, 0.3, 64), mat(0x5ec8f2, { roughness: 0.25 }), { y: -0.45, cast: false, recv: true });
  scene.add(water);
  world.add(mesh(new THREE.CylinderGeometry(6.2, 6.6, 0.7, 64), 0xf6d68b, { y: -0.25, recv: true }));
  world.add(mesh(new THREE.CylinderGeometry(5.9, 6.2, 0.25, 64), 0x86d47a, { y: 0.12, cast: false, recv: true }));
  const pickables = [];
  const R = 4.3;
  games.forEach((id, i) => {
    const a = i / games.length * Math.PI * 2;
    const pad = new THREE.Group();
    pad.position.set(Math.sin(a) * R, 0.25, Math.cos(a) * R);
    pad.add(mesh(new THREE.CylinderGeometry(0.75, 0.8, 0.12, 32), 0xffffff, { y: 0.06, recv: true }));
    const lm = landmark(id); lm.position.y = 0.12; pad.add(lm);
    const hit = mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.8, 12), new THREE.MeshBasicMaterial({ visible: false }), { y: 0.9, cast: false });
    pad.add(hit);
    pad.userData = { pick: true, id, lm };
    world.add(pad); pickables.push(pad);
  });
  const rk = rocket(); rk.position.y = 0.24;
  const rkPad = new THREE.Group(); rkPad.add(rk);
  rkPad.add(mesh(new THREE.CylinderGeometry(1.0, 1.05, 0.14, 40), COL.yellow, { y: 0.3, recv: true }));
  rkPad.add(mesh(new THREE.CylinderGeometry(1.0, 1.0, 2.6, 12), new THREE.MeshBasicMaterial({ visible: false }), { y: 1.3, cast: false }));
  rkPad.userData = { pick: true, id: 'adv', lm: rk };
  world.add(rkPad); pickables.push(rkPad);
  // little trees
  for (let i = 0; i < 9; i++) { const a = (i + 0.5) / 9 * Math.PI * 2; const t = new THREE.Group();
    t.add(mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.35), COL.brown, { y: 0.17 })); t.add(mesh(new THREE.ConeGeometry(0.3, 0.7, 10), 0x2e9d5b, { y: 0.6 }));
    t.position.set(Math.sin(a) * 5.55, 0.24, Math.cos(a) * 5.55); world.add(t); }
  const starGroup = new THREE.Group(); world.add(starGroup);
  let rotY = 0.3, vel = 0, bounce = null;
  const view = {
    key, host, scene, camera, pickables, keep: true, onPick,
    fit(asp) { const d = asp < 0.9 ? 19 : asp < 1.3 ? 16 : 13.5; camera.position.set(0, d * 0.62, d * 0.78); camera.lookAt(0, 0.4, 0); },
    setStars(n) {
      const want = Math.min(40, n | 0);
      while (starGroup.children.length > want) starGroup.remove(starGroup.children[starGroup.children.length - 1]);
      while (starGroup.children.length < want) { const k = starGroup.children.length; const s = star(0.42);
        s.userData = { a: k * 2.39996, r: 1.5 + (k % 4) * 0.28, h: 2.4 + (k % 5) * 0.35 }; starGroup.add(s); }
    },
    drag(dx) { vel = 0; rotY += dx * 4; },
    tap(o) {
      if (bounce) return;
      const lm = o.userData.lm, y0 = lm.position.y;
      bounce = true;
      tween(0.45, k => { lm.position.y = y0 + Math.sin(k * Math.PI) * 0.6; lm.rotation.y = k * Math.PI * 2; }, () => { lm.position.y = y0; lm.rotation.y = 0; bounce = null; view.onPick && view.onPick(o.userData.id); });
    },
    update(dt, t) {
      if (!reduced()) rotY += dt * 0.07;
      world.rotation.y = rotY;
      water.position.y = -0.45 + Math.sin(t * 1.2) * 0.03;
      rk.position.y = 0.24 + (reduced() ? 0 : Math.sin(t * 2) * 0.08);
      starGroup.children.forEach(s => { const u = s.userData; const a = u.a + t * 0.35; s.position.set(Math.sin(a) * u.r, u.h + Math.sin(t * 1.5 + u.a) * 0.15, Math.cos(a) * u.r); s.rotation.y = t * 1.5 + u.a; });
    }
  };
  view.setStars(stars);
  islandView = view; mount(view);
}

/* ---------- game questions ---------- */
function gameScene(host, ground = 0xbfe6a6) {
  const scene = baseScene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  const floor = mesh(new THREE.CircleGeometry(14, 48), mat(ground, { roughness: 0.9 }), { cast: false, recv: true }); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  return { scene, camera };
}
function wobble(o) { const r0 = o.rotation.z; tween(0.5, k => { o.rotation.z = r0 + Math.sin(k * Math.PI * 4) * 0.25 * (1 - k); }, () => { o.rotation.z = r0; }); }
function hop(o, spin = true) { const y0 = o.position.y, r0 = o.rotation.y; tween(0.7, k => { o.position.y = y0 + Math.sin(k * Math.PI) * 1.1; if (spin) o.rotation.y = r0 + ease(k) * Math.PI * 2; }, () => { o.position.y = y0; }); }

/* api = { say, tone, setSay(text), right(), wrong(spokenLabel) }, els = { host, askEl, choicesEl } */
export function question(id, level, els, api) {
  if (id === 'shapes3d') return shapesQ(level, els, api);
  if (id === 'where3d') return whereQ(level, els, api);
  if (id === 'count3d') return countQ(level, els, api);
}

function shapesQ(lv, { host, askEl, choicesEl }, api) {
  const basic = ['cube', 'sphere', 'cone', 'cylinder'];
  let target, others, ask;
  const kind = lv === 1 ? 'name' : lv === 2 ? pick(['name', 'name', 'roll', 'point']) : pick(['name', 'like', 'like', 'roll', 'point']);
  if (kind === 'roll') { target = pick(['sphere', 'cylinder']); others = shuffle(['cube', 'pyramid', 'prism']).slice(0, 2); ask = 'Which shape can roll?'; }
  else if (kind === 'point') { target = pick(['cone', 'pyramid']); others = shuffle(['cube', 'sphere', 'cylinder', 'prism']).slice(0, 2); ask = 'Which shape has a pointy top?'; }
  else if (kind === 'like') {
    const L = [['sphere', 'Which shape looks like a ball?'], ['cylinder', 'Which shape looks like a can of soup?'], ['cone', 'Which shape looks like an ice cream cone?'], ['cube', 'Which shape looks like a dice block?'], ['pyramid', 'Which shape looks like a tent?']];
    const p = pick(L); target = p[0]; ask = p[1];
    const pool = ['cube', 'sphere', 'cone', 'cylinder', 'pyramid'].filter(s => s !== target && !(target === 'cone' && s === 'pyramid') && !(target === 'pyramid' && s === 'cone'));
    others = shuffle(pool).slice(0, 2);
  } else {
    const pool = lv === 1 ? basic : basic.concat(['pyramid', 'prism']);
    target = pick(pool); others = shuffle(pool.filter(s => s !== target && !(target === 'cone' && s === 'pyramid') && !(target === 'pyramid' && s === 'cone'))).slice(0, 2);
    ask = `Find the ${SOLID_NAME[target]}.`;
  }
  const { scene, camera } = gameScene(host, 0xd6f0ff);
  const order = shuffle([target, ...others]);
  const cols = shuffle(PALETTE);
  const group = new THREE.Group(); scene.add(group);
  const pickables = [], solids = [];
  order.forEach((s, i) => {
    const holder = new THREE.Group(); holder.position.x = (i - 1) * 2.35;
    holder.add(mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.35, 32), 0xffffff, { y: 0.18, recv: true }));
    const geo = SOLIDS[s](); geo.computeBoundingBox();
    const so = mesh(geo, mat(cols[i], { roughness: 0.4 }));
    so.position.y = 0.35 - geo.boundingBox.min.y + 0.02;
    so.rotation.x = s === 'cylinder' || s === 'cone' || s === 'pyramid' ? 0.12 : 0.25;
    holder.add(so);
    holder.add(mesh(new THREE.CylinderGeometry(1.05, 1.05, 2.4, 12), new THREE.MeshBasicMaterial({ visible: false }), { y: 1.2, cast: false }));
    holder.userData = { pick: true, s, so };
    group.add(holder); pickables.push(holder); solids.push(so);
  });
  let spin = 0, done = false;
  const sayAll = `${ask} Drag to spin them. Tap your answer.`;
  askEl.textContent = ask; choicesEl.innerHTML = '';
  api.setSay(ask);
  const view = {
    host, scene, camera, pickables,
    fit(asp) { const d = Math.max(8.2, 10.4 / asp); camera.position.set(0, d * 0.34, d); camera.lookAt(0, 0.95, 0); },
    drag(dx) { spin += dx * 6; },
    tap(o) {
      if (done) return;
      if (o.userData.s === target) { done = true; hop(o.userData.so); api.right(); }
      else { wobble(o.userData.so); api.wrong(`a ${SOLID_NAME[o.userData.s]}`); }
    },
    update(dt) { if (!reduced()) spin += dt * 0.6; solids.forEach((s, i) => { s.rotation.y = spin + i; }); }
  };
  mount(view);
  api.say(sayAll);
}

function table() {
  const t = new THREE.Group(), wood = 0xb07a4a;
  t.add(mesh(new THREE.BoxGeometry(3.0, 0.18, 1.7), wood, { y: 1.45, recv: true }));
  [[-1.35, -0.7], [1.35, -0.7], [-1.35, 0.7], [1.35, 0.7]].forEach(([x, z]) => t.add(mesh(new THREE.BoxGeometry(0.16, 1.4, 0.16), wood, { x, y: 0.7, z })));
  return t;
}
const WHERE = {
  on: { say: 'on the table', p: [-0.55, 1.54, 0] },
  under: { say: 'under the table', p: [0.35, 0, 0] },
  next: { say: 'next to the table', p: [2.45, 0, 0.1] },
  behind: { say: 'behind the table', p: [-0.2, 0, -2.0] },
  front: { say: 'in front of the table', p: [0.45, 0, 1.75] }
};
function whereQ(lv, { host, askEl, choicesEl }, api) {
  const pool = lv === 1 ? ['on', 'under', 'next'] : ['on', 'under', 'next', 'behind', 'front'];
  let chosen = shuffle(pool).slice(0, 3);
  if (chosen.includes('behind') && chosen.includes('under')) chosen = chosen.map(c => c === 'under' ? pool.find(p => !chosen.includes(p)) || c : c);
  const target = pick(chosen);
  const { scene, camera } = gameScene(host, 0xffe7b8);
  scene.add(table());
  const colors = shuffle([0xc68642, 0xff8fab, 0x7aa7ff, 0x9ad97a]);
  const pickables = [], bears = [];
  chosen.forEach((pos, i) => {
    const b = teddy(colors[i]); const [x, y, z] = WHERE[pos].p;
    b.position.set(x, y, z); b.scale.setScalar(pos === 'under' ? 0.85 : 0.95);
    b.rotation.y = pos === 'next' ? -0.5 : 0;
    b.add(mesh(new THREE.SphereGeometry(0.95, 10, 8), new THREE.MeshBasicMaterial({ visible: false }), { y: 0.65, cast: false }));
    b.userData = { pick: true, pos };
    scene.add(b); pickables.push(b); bears.push(b);
  });
  const ask = `Tap the bear that is ${WHERE[target].say}.`;
  askEl.textContent = ask; choicesEl.innerHTML = '';
  api.setSay(ask);
  let orbit = 0, done = false;
  const view = {
    host, scene, camera, pickables,
    fit(asp) { view.d = Math.max(7.2, 8.2 / asp); },
    drag(dx) { orbit = Math.max(-0.7, Math.min(0.7, orbit + dx * 2.5)); },
    tap(o) {
      if (done) return;
      if (o.userData.pos === target) { done = true; hop(o, false); api.right(); }
      else { wobble(o); api.wrong(`${WHERE[o.userData.pos].say}`); }
    },
    update(dt, t) {
      const d = view.d || 8;
      camera.position.set(Math.sin(orbit) * d, 3.3, Math.cos(orbit) * d); camera.lookAt(0.3, 0.9, 0);
      if (!reduced()) bears.forEach((b, i) => { b.children[1].rotation.z = Math.sin(t * 2 + i) * 0.08; });
    }
  };
  mount(view);
  api.say(ask);
}

function countQ(lv, { host, askEl, choicesEl }, api) {
  const max = [0, 5, 10, 15, 20][lv] || 10;
  const n = Math.max(2, Math.floor(Math.random() * (max - Math.max(1, max - 7) + 1)) + Math.max(1, max - 7));
  const kind = pick(['apples', 'oranges', 'strawberries', 'balls']);
  const { scene, camera } = gameScene(host, 0xa8dd8f);
  // ten-frame trays
  const trays = n > 10 ? 2 : 1, cell = 0.78, slots = [];
  for (let t = 0; t < trays; t++) {
    const tz = 2.2 + t * 1.75;
    scene.add(mesh(new THREE.BoxGeometry(cell * 5 + 0.2, 0.12, cell * 2 + 0.2), 0x6b4a2b, { y: 0.06, z: tz, recv: true }));
    for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) {
      const x = (c - 2) * cell, z = tz + (r - 0.5) * cell;
      scene.add(mesh(new THREE.BoxGeometry(cell - 0.08, 0.04, cell - 0.08), 0xfff4d6, { x, y: 0.14, z, recv: true, cast: false }));
      slots.push(new THREE.Vector3(x, 0.16, z));
    }
  }
  // scatter objects on the grass (jittered grid, no overlaps)
  const spots = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) spots.push([(c - 2.5) * 0.98 + (Math.random() - 0.5) * 0.2, -2.7 + r * 0.92 + (Math.random() - 0.5) * 0.15]);
  const chosen = shuffle(spots).slice(0, n);
  const pickables = [];
  chosen.forEach(([x, z]) => { const f = fruit(kind); f.scale.setScalar(1.35); f.position.set(x, 0, z); f.rotation.y = Math.random() * 6;
    f.add(mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ visible: false }), { y: 0.3, cast: false }));
    f.userData = { pick: true }; scene.add(f); pickables.push(f); });
  let counted = 0, choicesShown = false;
  const ask = `Tap each one to count the ${kind}.`;
  askEl.textContent = ask; choicesEl.innerHTML = '';
  api.setSay(ask);
  function showChoices() {
    choicesShown = true;
    const q = `How many ${kind} did you count?`;
    askEl.textContent = q; api.setSay(q);
    const opts = new Set([n]); const near = shuffle([-2, -1, 1, 2]);
    for (const d of near) { if (opts.size >= 3) break; if (n + d >= 1) opts.add(n + d); }
    choicesEl.innerHTML = shuffle([...opts]).map(v => `<button class="ch" type="button" data-v="${v}"><span class="n">${v}</span></button>`).join('');
    choicesEl.querySelectorAll('.ch').forEach(b => b.onclick = () => {
      const v = +b.dataset.v;
      if (v === n) { b.classList.add('ok'); api.right(); }
      else { b.classList.add('no'); api.wrong(String(v)); }
    });
    api.say(`${n}! ${q}`);
  }
  const view = {
    host, scene, camera, pickables,
    fit(asp) { const d = Math.max(6.4, 7.6 / asp) + (trays - 1) * 0.9; camera.position.set(0, d * 0.88, d * 0.62); camera.lookAt(0, 0, 0.3 + (trays - 1) * 0.7); },
    tap(o) {
      if (o.userData.moved) return;
      o.userData.moved = true;
      const i = counted++; const to = slots[i], from = o.position.clone();
      api.tone([400 + counted * 30], 0.08);
      api.say(String(counted));
      tween(0.55, k => { o.position.lerpVectors(from, to, ease(k)); o.position.y = to.y + Math.sin(k * Math.PI) * 1.6; o.rotation.y += 0.2; o.scale.setScalar(1.35 - 0.35 * ease(k)); }, () => {
        o.position.copy(to);
        if (counted === n && !choicesShown) setTimeout(showChoices, 650);
      });
    },
    update() {}
  };
  mount(view);
  api.say(`${ask} Count out loud with me!`);
}

/* ---------- celebration chest ---------- */
export function celebrate(host, stars = 3) {
  const scene = baseScene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  const chest = new THREE.Group(); scene.add(chest);
  const wood = mat(0x9c5a2a), gold = goldMat();
  chest.add(mesh(new THREE.BoxGeometry(2.2, 1.1, 1.4), wood, { y: 0.55 }));
  chest.add(mesh(new THREE.BoxGeometry(2.26, 0.14, 1.46), gold, { y: 0.35 }));
  chest.add(mesh(new THREE.BoxGeometry(0.3, 0.4, 0.1), gold, { y: 0.95, z: 0.72 }));
  chest.add(mesh(new THREE.BoxGeometry(1.9, 0.2, 1.1), mat(0xffe27a, { emissive: 0xffc93c, emissiveIntensity: 0.6 }), { y: 1.02 }));
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, 1.1, -0.7); chest.add(lidPivot);
  const lid = mesh(new THREE.BoxGeometry(2.3, 0.38, 1.48), wood, { y: 0.19, z: 0.72 }); lidPivot.add(lid); lidPivot.add(mesh(new THREE.BoxGeometry(2.34, 0.1, 0.2), gold, { y: 0.2, z: 1.38 }));
  const glow = new THREE.PointLight(0xffd27a, 0, 8); glow.position.set(0, 1.6, 0); scene.add(glow);
  const flying = [];
  const count = Math.max(1, stars) * 6;
  for (let i = 0; i < count; i++) { const s = star(0.5); s.visible = false; s.userData = { v: new THREE.Vector3((Math.random() - 0.5) * 3.2, 5 + Math.random() * 2.5, (Math.random() - 0.3) * 1.6), r: Math.random() * 6 }; scene.add(s); flying.push(s); }
  const hero = star(1.1); hero.position.set(0, 2.5, 0); hero.scale.setScalar(0.001); scene.add(hero);
  let t0 = null;
  const view = {
    host, scene, camera, pickables: [],
    fit(asp) { const d = Math.max(7, 7 / asp); camera.position.set(0, 3.2, d); camera.lookAt(0, 1.5, 0); },
    update(dt, t) {
      if (t0 === null) t0 = t;
      const e = t - t0;
      chest.rotation.y = Math.sin(t * 0.8) * 0.25;
      const open = Math.min(1, Math.max(0, (e - 0.3) / 0.5));
      lidPivot.rotation.x = -ease(open) * 1.9;
      glow.intensity = open * 3;
      if (e > 0.6) flying.forEach((s, i) => {
        if (!s.visible && e > 0.6 + i * 0.03) { s.visible = true; s.position.set(0, 1.1, 0); s.userData.v0 = s.userData.v.clone(); }
        if (s.visible) { const u = s.userData; u.v0.y -= 9.8 * dt; s.position.addScaledVector(u.v0, dt); s.rotation.set(u.r + e * 4, e * 3, 0); if (s.position.y < -1) s.visible = false; }
      });
      const hs = Math.min(1, Math.max(0, (e - 0.8) / 0.6)); hero.scale.setScalar(Math.max(0.001, ease(hs) * 1.1)); hero.rotation.y = t * 1.8;
      hero.position.y = 2.6 + Math.sin(t * 2) * 0.12;
    }
  };
  if (chestView) disposeView(chestView);
  chestView = view;
  mount(view);
}
