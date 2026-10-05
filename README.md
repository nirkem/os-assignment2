# xv6: Peterson locks and a tournament tree

Mutual exclusion for [xv6](https://github.com/mit-pdos/xv6-riscv), MIT's small Unix-like teaching kernel for RISC-V. Written for the Operating Systems course at Ben-Gurion University in 2025 (assignment 2).

This was a pair assignment. Part 1, the kernel Peterson lock, was written by my partner. Part 2, the tournament tree built on top of it, is mine.

## Part 1: Peterson's lock in the kernel

Peterson's algorithm lets two processes share a critical section using only shared memory. Each side raises an "interested" flag and records that it arrived last. A side waits only while the other one is interested and it is still the last to have arrived.

- The kernel keeps 15 locks and exposes them through four system calls: `peterson_create`, `peterson_acquire(id, role)`, `peterson_release(id, role)` and `peterson_destroy(id)`. Each side of a lock has a role, `0` or `1`.
- Flag writes use atomic builtins and memory barriers (`__sync_lock_test_and_set`, `__sync_synchronize`), so the CPU can't reorder them.
- A waiting process calls `yield()` instead of spinning, giving the CPU to someone else.
- `peterson_test` has a parent and a child take turns in the critical section 10 times each.

## Part 2: the tournament tree

A Peterson lock only works for two processes. A tournament tree stretches it to `N` processes, where `N` is a power of two up to 16. It does that by playing a knockout bracket of two-process locks.

- **The bracket.** `N - 1` locks form a binary tree, stored like a heap: the lock at level `l`, position `j` has ID `2^l - 1 + j`. Each process starts at the bottom and has to win every lock on its path to the root.
- **Your path is your index.** Process `i` doesn't need a lookup table. At each level, its lock is `i >> (L - level)` and its role is the matching bit of `i`, where `L = log2(N)`. For example, with 8 processes, process 5 (`101`) plays role 1 at the bottom, role 0 one level up, and role 1 at the root.
- **Acquire up, release down.** `tournament_acquire` takes the locks from the leaf up to the root. `tournament_release` gives them back from the root down, the reverse of the order they were taken.

The library API (`user/libtournament.c`):

| Call | What it does |
| --- | --- |
| `tournament_create(n)` | Creates `n - 1` Peterson locks, forks `n` processes and returns each its index `0` to `n - 1` |
| `tournament_acquire()` | Wins every lock from this process's leaf to the root |
| `tournament_release()` | Releases them from the root back down |
| `tournament_destroy()` | Destroys the tournament's own locks, and no others |

`tournament N` runs a full round: every process takes the root lock, prints that it has it, and releases it. Then the parent waits for all of them and destroys the locks.

There's also an [interactive version of the bracket](https://nirmichalovitz.com/demos/tournament-tree) that runs the same algorithm step by step in the browser.

## Build and run

The repo includes a devcontainer with the RISC-V toolchain and QEMU. Open it in VS Code and choose "Reopen in Container", or install `gcc-riscv64-linux-gnu` and `qemu-system-misc` yourself. Then:

```bash
make qemu
```

At the xv6 prompt, run `peterson_test`, or `tournament 4` (any power of two up to 16). Quit QEMU with `Ctrl-A`, then `X`.

## Files

| File | Part | Role |
| --- | --- | --- |
| `kernel/peterson.c`, `kernel/peterson.h` | 1 | The lock table and the algorithm |
| `kernel/sysproc.c`, `kernel/syscall.c`, `kernel/syscall.h` | 1 | The four system calls |
| `user/peterson_test.c` | 1 | Two-process test |
| `user/libtournament.c` | 2 | The tournament tree library |
| `user/tournament.c` | 2 | `tournament N` |

The original xv6 README and its credits are in [`README`](README), and the MIT license is in [`LICENSE`](LICENSE).
