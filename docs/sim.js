/*
  Tournament-tree lock simulation, mirroring user/libtournament.c and kernel/peterson.c.
  N processes (a power of two) share N - 1 two-process Peterson locks arranged as a heap:
  the lock at level l, position j is lock 2^l - 1 + j, and the root is level 0.

  Each call to step() lets one randomly chosen process do one small action, which is how a real
  scheduler interleaves them. At its current lock a process first raises its "interested" flag,
  then records that it arrived last (turn = role), then waits until the other side is not
  interested or someone arrived after it. Winning the root means entering the critical section.
  Leaving releases every lock from the root back down to the leaf.
*/

/** @typedef {'flag' | 'turn' | 'wait' | 'cs' | 'release' | 'done'} Phase */

/**
 * @typedef {object} Proc
 * @property {number} id
 * @property {number} level Level of the lock being contested (or released); L - 1 is the leaf level, 0 the root.
 * @property {Phase} phase
 * @property {boolean} started False until the process has taken its first step.
 * @property {boolean} blocked True while it is blocked at its current lock.
 * @property {number} csLeft
 */

/**
 * @typedef {{ kind: 'wait' | 'win', proc: number, lock: number, role: number }
 *   | { kind: 'enter' | 'leave' | 'done', proc: number }} SimEvent
 */

/** Steps a process spends inside the critical section. */
const CS_STEPS = 4;

export class Tournament {
  /**
   * @param {number} n number of processes: 2, 4, 8 or 16
   * @param {() => number} [random]
   */
  constructor(n, random = Math.random) {
    if (n < 2 || n > 16 || (n & (n - 1)) !== 0) throw new Error('n must be a power of two from 2 to 16');
    this.n = n;
    this.L = Math.log2(n);
    this.random = random;
    this.steps = 0;
    this.inside = 0;
    this.mostInside = 0;
    this.entered = 0;
    /** False when the last step was a blocked process checking again and still having to wait. */
    this.lastChanged = true;
    /** @type {{ interested: [boolean, boolean], turn: 0 | 1 }[]} */
    this.locks = Array.from({ length: n - 1 }, () => ({ interested: [false, false], turn: 0 }));
    /** @type {Proc[]} */
    this.procs = Array.from({ length: n }, (_, id) => ({
      id,
      level: this.L - 1,
      phase: 'flag',
      started: false,
      blocked: false,
      csLeft: 0,
    }));
  }

  /** Heap index of process i's lock at a level, as get_my_lock() computes it. */
  lockAt(i, level) {
    return (i >> (this.L - level)) + (1 << level) - 1;
  }

  /** Process i's side (0 or 1) of its lock at a level: one bit of its index, as get_my_role() reads it. */
  roleAt(i, level) {
    return (i >> (this.L - 1 - level)) & 1;
  }

  get finished() {
    return this.procs.every((p) => p.phase === 'done');
  }

  /**
   * Let one runnable process take one action.
   * @returns {SimEvent[]} what happened worth reporting
   */
  step() {
    const runnable = this.procs.filter((p) => p.phase !== 'done');
    if (runnable.length === 0) return [];
    this.steps++;
    return this.advance(runnable[Math.floor(this.random() * runnable.length)]);
  }

  /** @param {Proc} p */
  advance(p) {
    p.started = true;
    this.lastChanged = true;
    /** @type {SimEvent[]} */
    const events = [];

    if (p.phase === 'cs') {
      p.csLeft--;
      if (p.csLeft === 0) {
        this.inside--;
        p.phase = 'release';
        p.level = 0;
        events.push({ kind: 'leave', proc: p.id });
      }
      return events;
    }

    const id = this.lockAt(p.id, p.level);
    const role = this.roleAt(p.id, p.level);
    const lock = this.locks[id];

    switch (p.phase) {
      case 'flag':
        lock.interested[role] = true;
        p.phase = 'turn';
        break;
      case 'turn':
        lock.turn = role;
        p.phase = 'wait';
        break;
      case 'wait':
        if (lock.interested[1 - role] && lock.turn === role) {
          if (p.blocked) this.lastChanged = false;
          else events.push({ kind: 'wait', proc: p.id, lock: id, role });
          p.blocked = true;
          break;
        }
        p.blocked = false;
        events.push({ kind: 'win', proc: p.id, lock: id, role });
        if (p.level === 0) {
          p.phase = 'cs';
          p.csLeft = CS_STEPS;
          this.inside++;
          this.entered++;
          this.mostInside = Math.max(this.mostInside, this.inside);
          events.push({ kind: 'enter', proc: p.id });
        } else {
          p.level--;
          p.phase = 'flag';
        }
        break;
      case 'release':
        lock.interested[role] = false;
        if (p.level === this.L - 1) {
          p.phase = 'done';
          events.push({ kind: 'done', proc: p.id });
        } else {
          p.level++;
        }
        break;
    }
    return events;
  }

  /** Levels of the locks process p currently holds (has won and not yet released). */
  heldLevels(p) {
    const levels = [];
    for (let l = 0; l < this.L; l++) {
      const holds =
        p.phase === 'cs' ||
        (p.phase === 'release' && l >= p.level) ||
        ((p.phase === 'flag' || p.phase === 'turn' || p.phase === 'wait') && p.started && l > p.level);
      if (holds) levels.push(l);
    }
    return levels;
  }
}
