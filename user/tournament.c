#include "kernel/types.h"
#include "kernel/stat.h"
#include "user/user.h"

int main(int argc, char* argv[]) {
  if (argc != 2) {
    printf("Error: Should be tournament + <number_of_processes>\n");
    exit(1);
  }

  int processes = atoi(argv[1]);
  if (!power_of_two(processes) || processes > 16) {
    printf("Error: number_of_processes must be a power of 2 and <= 16\n");
    exit(1);
  }

  int main_process_pid = getpid();

  // Create the tournament tree
  int tournament_id = tournament_create(processes);
  if (tournament_id < 0) {
    printf("Error: Failed to create tournament tree\n");
    exit(1);
  }

  // Acquire the lock at the root of the tree
  if (getpid() != main_process_pid) {

    tournament_acquire();
    printf("Process %d acquired the lock (tournament ID: %d)\n", getpid(), tournament_id);
    tournament_release();

    exit(0);

  } else {
    for (int i = 0; i < processes; i++) {
      wait(0);
    }
  } 

  // delete the locks, in-case we want to run again later
  for (int i = 0; i < processes; i++) {
    peterson_destroy(i);
  }

  printf("All child processes have finished\n");
  exit(0);
}
