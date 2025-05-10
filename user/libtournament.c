#include "kernel/types.h"
#include "kernel/stat.h"
#include "user/user.h"

int L;
int index;

int get_log2(int n) {
  int log = 0;
  while (n > 1) {
    n /= 2;
    log++;
  }
  return log;
}

int get_my_lock_index(int pid, int level) {
  int index = get_my_index(pid);
  int shifts = L - level;
  return index >> shifts;
}

int get_my_role(int pid, int level) {
  int index = get_my_index(pid);
  int shifts = L - 1 - level;
  return (index & (1 << shifts)) >> shifts;
}

int get_my_index(int pid) {
  return index;
}

int get_my_lock(int pid, int level) {
  int lock_index = get_my_lock_index(pid, level);
  int i = lock_index + (1 << level) - 1;
  return i;
}

int power_of_two(int n) {
  if (n < 1) {
    return 0;
  }
  while (n > 1) {
    if (n % 2 != 0) {
      return 0;
    }
    n /= 2;
  }
  return 1;
}

int tournament_create(int processes) {
  if (!power_of_two(processes) || processes > 16) {
    return -1;
  }


  int lock_id;
  int i;
  int main_process_pid = getpid();
  L = get_log2(processes);

  for (i = 0; i < processes - 1; i++) {
    lock_id = peterson_create();
    if (lock_id < 0) {
      return -1;
    }
  }

  // Fork processes and assign indices
  for (i = 0; i < processes; i++) {

    // if im the main process, fork a child
    if (getpid() == main_process_pid) {
      int pid = fork();
      if (pid < 0) {
        // Fork failed
        return -1;
      }
      else if (pid == 0) {
        // Child process
        index = i;
        break; // Exit the loop in the child process
      }
    }
  }

  L = get_log2(processes);
  return 0;
}

int tournament_acquire(void) {
  int pid = getpid();
  int level = L - 1;

  // Traverse the tree from the root to the leaf
  while (level >= 0) {
    int lock_id = get_my_lock(pid, level);
    int role = get_my_role(pid, level);

    // Acquire the lock using Peterson's algorithm
    peterson_acquire(lock_id, role);

    // Move to the next level
    level--;
  }

  return 0;
}

int tournament_release(void) {
  int pid = getpid();
  int level = 0;
  int lock_id;
  int role;

  // Traverse the tree from the root to the leaf
  while (level < L) {
    lock_id = get_my_lock(pid, level);
    role = get_my_role(pid, level);

    // Release the lock using Peterson's algorithm
    peterson_release(lock_id, role);

    // Move to the next level
    level++;
  }

  return 0;
}

