// Draws the tournament tree as SVG and drives the simulation in sim.js.
import { Tournament } from './sim.js';

const SVG = 'http://www.w3.org/2000/svg';
const DELAYS = [700, 450, 280, 160, 80];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const svg = document.getElementById('tt-svg');
const playBtn = document.getElementById('tt-play');
const stepBtn = document.getElementById('tt-step');
const resetBtn = document.getElementById('tt-reset');
const speed = document.getElementById('tt-speed');
const statusEl = document.getElementById('tt-status');
const logEl = document.getElementById('tt-log');
const segButtons = [...document.querySelectorAll('.seg-btn')];

// ?n=16 links straight to a size. Otherwise phones get the 4-process tree: 8 works, but gets small.
const params = new URLSearchParams(location.search);
const asked = Number(params.get('n'));
if (params.has('still')) document.documentElement.classList.add('still');
let n = [2, 4, 8, 16].includes(asked) ? asked : window.matchMedia('(max-width: 639px)').matches ? 4 : 8;
let sim = new Tournament(n);
let selected = n === 8 ? 5 : n - 1;
let timer;
let log = [];

// Geometry for the current size, rebuilt on reset.
let W = 760;
let rowH = 96;
const TOP = 34;
const SIDE = 46;
let tokens = [];
let lockEls = [];
let edgeEls = new Map();
let csEl;

function el(tag, attrs = {}) {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

const levelY = (level) => TOP + (level + 1) * rowH;
const lockPos = (id) => {
  const level = Math.floor(Math.log2(id + 1));
  const j = id - ((1 << level) - 1);
  return { x: ((j + 0.5) * W) / (1 << level), y: levelY(level) };
};
const leafPos = (i) => ({ x: ((i + 0.5) * W) / n, y: levelY(sim.L) });
const csPos = () => ({ x: W / 2 + 62, y: TOP });
const bits = (i) => i.toString(2).padStart(sim.L, '0');

function build() {
  // Only as wide as the bracket needs, so small trees draw larger (and stay readable on phones).
  W = { 2: 420, 4: 560, 8: 760, 16: 1040 }[n] ?? 760;
  rowH = n === 16 ? 86 : 96;
  const H = levelY(sim.L) + 52;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.querySelectorAll(':scope > g').forEach((g) => g.remove());

  const edges = el('g');
  const locks = el('g');
  const leaves = el('g');
  const toks = el('g');
  svg.append(edges, locks, leaves, toks);
  edgeEls = new Map();
  lockEls = [];
  tokens = [];

  // Critical section box above the root.
  csEl = el('g', { class: 'tt-cs' });
  const root = lockPos(0);
  edges.append(el('line', { class: 'tt-edge', x1: root.x, y1: root.y - 15, x2: root.x, y2: TOP + 20 }));
  csEl.append(el('rect', { x: W / 2 - 110, y: TOP - 20, width: 220, height: 40, rx: 12 }));
  const csLabel = el('text', { x: W / 2 - 40, y: TOP + 4, 'text-anchor': 'middle' });
  csLabel.textContent = 'critical section';
  csEl.append(csLabel);
  locks.append(csEl);

  for (let id = 0; id < n - 1; id++) {
    const { x, y } = lockPos(id);
    const level = Math.floor(Math.log2(id + 1));
    // Edges from the two children (locks one level down, or processes at the leaves) to each side.
    for (const role of [0, 1]) {
      const child = level === sim.L - 1 ? leafPos(2 * (id - ((1 << level) - 1)) + role) : lockPos(2 * id + 1 + role);
      const line = el('line', { class: 'tt-edge', x1: child.x, y1: child.y - 15, x2: x + (role ? 20 : -20), y2: y + 15 });
      edges.append(line);
      edgeEls.set(`${id}:${role}`, line);
    }
    const g = el('g', { class: 'tt-lock' });
    g.append(el('rect', { class: 'box', x: x - 31, y: y - 15, width: 62, height: 30, rx: 9 }));
    // Flags sit near the box edges so two-digit labels (L10 to L14) fit between them.
    g.append(el('rect', { class: 'flag', x: x - 25, y: y - 6, width: 10, height: 10, rx: 2, 'data-role': 0 }));
    g.append(el('rect', { class: 'flag', x: x + 15, y: y - 6, width: 10, height: 10, rx: 2, 'data-role': 1 }));
    g.append(el('line', { class: 'turn', x1: x - 26, y1: y + 9, x2: x - 14, y2: y + 9 }));
    const label = el('text', { x, y: y + 4, 'text-anchor': 'middle' });
    label.textContent = `L${id}`;
    g.append(label);
    locks.append(g);
    lockEls.push(g);
  }

  for (let i = 0; i < n; i++) {
    const { x, y } = leafPos(i);
    const b = el('text', { class: 'tt-bits', x, y: y + 32, 'text-anchor': 'middle' });
    b.textContent = bits(i);
    leaves.append(b);

    const t = el('g', { class: 'tt-token', tabindex: 0, role: 'button', 'aria-label': `Follow process ${i}` });
    t.append(el('circle', { r: 15 }));
    const label = el('text', { 'text-anchor': 'middle', y: 4 });
    label.textContent = `P${i}`;
    t.append(label);
    t.addEventListener('click', () => select(i));
    t.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        select(i);
      }
    });
    toks.append(t);
    tokens.push(t);
  }
}

function tokenPos(i) {
  const p = sim.procs[i];
  if (!p.started || p.phase === 'done') return leafPos(i);
  if (p.phase === 'cs') return csPos();
  const { x, y } = lockPos(sim.lockAt(i, p.level));
  return { x: x + (sim.roleAt(i, p.level) ? SIDE : -SIDE), y };
}

const contending = (p) => p.started && (p.phase === 'flag' || p.phase === 'turn' || p.phase === 'wait');

function render() {
  // Which side of which lock each process is at, or holds.
  const side = new Map();
  for (const p of sim.procs) {
    for (const l of sim.heldLevels(p)) side.set(`${sim.lockAt(p.id, l)}:${sim.roleAt(p.id, l)}`, 'held');
    if (contending(p)) side.set(`${sim.lockAt(p.id, p.level)}:${sim.roleAt(p.id, p.level)}`, 'contending');
  }
  edgeEls.forEach((line, key) => line.setAttribute('data-state', side.get(key) ?? 'idle'));

  sim.locks.forEach((lock, id) => {
    const g = lockEls[id];
    g.setAttribute('data-held', String(side.get(`${id}:0`) === 'held' || side.get(`${id}:1`) === 'held'));
    g.querySelectorAll('.flag').forEach((f) => f.setAttribute('data-on', String(lock.interested[Number(f.dataset.role)])));
    const turn = g.querySelector('.turn');
    turn.style.transform = `translateX(${lock.turn ? 40 : 0}px)`;
    turn.style.opacity = lock.interested[0] || lock.interested[1] ? '1' : '0.25';
  });

  csEl.setAttribute('data-busy', String(sim.inside > 0));

  sim.procs.forEach((p, i) => {
    const { x, y } = tokenPos(i);
    const t = tokens[i];
    t.style.transform = `translate(${x}px, ${y}px)`;
    t.setAttribute('data-blocked', String(p.blocked));
    t.setAttribute('data-inside', String(p.phase === 'cs'));
    t.setAttribute('data-done', String(p.phase === 'done'));
    t.setAttribute('data-selected', String(i === selected));
  });

  document.getElementById('tt-steps').textContent = String(sim.steps);
  document.getElementById('tt-entered').textContent = `${sim.entered}/${n}`;
  document.getElementById('tt-most').textContent = String(sim.mostInside);
  logEl.replaceChildren(
    ...log.map((line) => {
      const li = document.createElement('li');
      li.textContent = line;
      return li;
    }),
  );
  renderSelected();
  renderPlay();
}

function renderSelected() {
  const p = sim.procs[selected];
  document.getElementById('tt-sel-id').textContent = String(selected);
  document.getElementById('tt-sel-index').textContent = String(selected);
  document.getElementById('tt-sel-bits').textContent = bits(selected);
  const held = new Set(sim.heldLevels(p));
  const rows = [];
  for (let l = sim.L - 1; l >= 0; l--) {
    const where = l === 0 ? 'root' : l === sim.L - 1 ? 'leaf' : `level ${l}`;
    const state = held.has(l) ? 'held' : contending(p) && p.level === l ? (p.blocked ? 'waiting' : 'trying') : '';
    const li = document.createElement('li');
    const left = document.createElement('span');
    left.className = 'where';
    left.textContent = `${where}  L${sim.lockAt(selected, l)}  role ${sim.roleAt(selected, l)}`;
    const right = document.createElement('span');
    right.textContent = state;
    right.className = state === 'held' ? 'accent' : 'muted';
    li.append(left, right);
    rows.push(li);
  }
  document.getElementById('tt-sel-path').replaceChildren(...rows);
}

function renderPlay() {
  const state = sim.finished ? 'finished' : timer !== undefined ? 'playing' : 'paused';
  playBtn.querySelectorAll('[data-when]').forEach((s) => (s.hidden = s.dataset.when !== state));
  stepBtn.disabled = sim.finished;
}

function describe(e) {
  switch (e.kind) {
    case 'wait':
      return `P${e.proc} waits at L${e.lock}: the other side got there first`;
    case 'win':
      return `P${e.proc} wins L${e.lock} as role ${e.role}`;
    case 'enter':
      return `P${e.proc} enters the critical section`;
    case 'leave':
      return `P${e.proc} leaves, releasing from the root down`;
    default:
      return null;
  }
}

function tick() {
  // Skip steps where a blocked process checks again and still has to wait: nothing changes on screen.
  let events = [];
  for (let k = 0; k < 400 && !sim.finished; k++) {
    events = sim.step();
    if (sim.lastChanged) break;
  }
  for (const e of events) {
    const line = describe(e);
    if (line) log = [line, ...log].slice(0, 7);
    if (e.kind === 'enter') statusEl.textContent = `In the critical section: P${e.proc}`;
    if (e.kind === 'leave') statusEl.textContent = 'The critical section is free';
  }
  if (sim.finished) {
    stop();
    statusEl.textContent = `Round over: all ${n} processes got in, never more than one at a time.`;
  }
  render();
}

function play() {
  if (sim.finished) reset();
  stop();
  timer = window.setInterval(tick, DELAYS[Number(speed.value) - 1]);
  renderPlay();
}

function stop() {
  if (timer !== undefined) window.clearInterval(timer);
  timer = undefined;
  renderPlay();
}

function reset() {
  stop();
  sim = new Tournament(n);
  if (selected >= n) selected = n - 1;
  log = [];
  statusEl.textContent = 'The critical section is free';
  build();
  render();
}

function select(i) {
  selected = i;
  render();
}

playBtn.addEventListener('click', () => (timer !== undefined ? stop() : play()));
stepBtn.addEventListener('click', () => {
  stop();
  tick();
});
resetBtn.addEventListener('click', reset);
speed.addEventListener('input', () => {
  if (timer !== undefined) play();
});
segButtons.forEach((b) =>
  b.addEventListener('click', () => {
    n = Number(b.dataset.n);
    segButtons.forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
    selected = n === 8 ? 5 : n - 1;
    reset();
  }),
);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stop();
});

segButtons.forEach((o) => o.setAttribute('aria-pressed', String(Number(o.dataset.n) === n)));
reset();

// Start on its own once the panel is in view, unless the visitor prefers less motion.
if (!reduceMotion) {
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        play();
      }
    },
    { threshold: 0.4 },
  );
  io.observe(svg);
}
