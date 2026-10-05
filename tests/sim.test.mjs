// Stress test for the visualizer's simulation: node tests/sim.test.mjs
import { Tournament } from '../docs/sim.js';

// Small seeded generator, so a failing run can be replayed
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let failures = 0;
const fail = (msg) => {
  console.log(`FAIL ${msg}`);
  failures++;
};

for (const n of [2, 4, 8, 16]) {
  let worst = 0;
  for (let seed = 1; seed <= 3000; seed++) {
    const t = new Tournament(n, mulberry32(seed * 7919 + n));
    const enters = [];
    while (!t.finished && t.steps < 200000) {
      for (const e of t.step()) if (e.kind === 'enter') enters.push(e.proc);
      if (t.inside > 1) {
        fail(`n=${n} seed=${seed}: ${t.inside} processes in the critical section`);
        break;
      }
    }
    if (!t.finished) fail(`n=${n} seed=${seed}: did not finish`);
    if (enters.length !== n || new Set(enters).size !== n) fail(`n=${n} seed=${seed}: entries ${enters}`);
    if (t.locks.some((l) => l.interested[0] || l.interested[1])) fail(`n=${n} seed=${seed}: a flag was left raised`);
    worst = Math.max(worst, t.steps);
  }
  console.log(`n=${n}: 3000 random schedules, longest took ${worst} steps`);
}

// The bit math from the README: with 8 processes, process 5 (101) plays roles 1, 0, 1 at locks 5, 2, 0
const t8 = new Tournament(8);
const roles = [2, 1, 0].map((l) => t8.roleAt(5, l)).join(',');
const locks = [2, 1, 0].map((l) => t8.lockAt(5, l)).join(',');
if (roles !== '1,0,1' || locks !== '5,2,0') fail(`process 5 path: roles ${roles}, locks ${locks}`);

console.log(failures === 0 ? 'all passed' : `${failures} failed`);
process.exit(failures ? 1 : 0);
