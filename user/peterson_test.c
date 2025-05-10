#include "kernel/types.h"
#include "user/user.h"


int
main(void)
{
    int lock_id = peterson_create();

    if (lock_id < 0) {
        printf("Faild to create lock\n");
        exit(1);
    }

    int fork_ret = fork();
    int role = fork_ret > 0 ? 0 : 1; // parent gets role 0, child gets role 1

    for (int i = 0; i < 10; i++) {
        if (peterson_acquire(lock_id, role) < 0) {
            printf("Faild to aquire lock\n");
            exit(1);
        }
        else{
            printf("Process %d acquired lock %d\n", role, lock_id);
        }

       // Critical section
        if (role == 0)
            printf("Parent process %d in critical section\n", role);
        else
            printf("Child process %d in critical section\n", role);
        // End critical section

        if (peterson_release(lock_id, role) < 0) {
            printf("Failed to release lock\n");
            exit(1);
        }
        
    }

    if (fork_ret > 0) {
        wait(0);
        printf("Parent process destroying lock\n");

        // only one process needs to destroy
        if (peterson_destroy(lock_id) < 0){
            printf("Faild to destroy lock\n");
            exit(1);
        }
           
    }

    exit(0);
}
