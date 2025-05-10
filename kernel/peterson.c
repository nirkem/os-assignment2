#include "types.h"       // basic integer types
#include "param.h"       // system parameters
#include "memlayout.h"   // MMU constants
#include "riscv.h"       // RISC-V definitions, incl. pte_t
#include "defs.h"        // kernel function prototypes
#include "peterson.h"    // our lock API

struct PetersonLock peterson_locks[NUM_PETERSON_LOCKS];

// Free-list for available lock IDs
static int free_ids[NUM_PETERSON_LOCKS];
static int free_count = 0;

int peterson_init(void) {

    free_count = NUM_PETERSON_LOCKS;
    for (int i = 0; i < NUM_PETERSON_LOCKS; i++) {
        free_ids[i] = NUM_PETERSON_LOCKS - i - 1; // Fill free_ids with available lock IDs
        peterson_locks[i].intrested[0] = 0;
        peterson_locks[i].intrested[1] = 0;
        peterson_locks[i].turn = 0;
        peterson_locks[i].active = 0;
    }
    return 0;
}

// Allocate a new Peterson lock; returns lock ID or -1 on failure
int peterson_create(void){
    if (free_count <= 0)
        return -1;  // no slots available

    // Initialize the new lock
    free_count--;
    int id = free_ids[free_count];
    peterson_locks[id].intrested[0] = 0;
    peterson_locks[id].intrested[1] = 0;
    peterson_locks[id].turn = 0;
    peterson_locks[id].active = 1; // Mark as active
    return id;
}

// Acquire lock id as role
int peterson_acquire(int lock_id, int role){

    if (lock_id < 0 || lock_id >= NUM_PETERSON_LOCKS || (role != 0 && role != 1) || !peterson_locks[lock_id].active)
        return -1;
    
    int other = 1 - role;
    struct PetersonLock *lk = &peterson_locks[lock_id];

    // Declare interest: atomic set with memory barriers
    __sync_synchronize();
    __sync_lock_test_and_set(&lk->intrested[role], 1);
    lk->turn = role;
    __sync_synchronize();

    // Wait until the other is not interested or it's this role's turn
    while (lk->intrested[other] && lk->turn == role) {
        
        yield(); // To avoid busy waiting
    }

    return 0;
}

// Release lock id as role 
int peterson_release(int lock_id, int role){

    if (lock_id < 0 || lock_id >= NUM_PETERSON_LOCKS || (role != 0 && role != 1) || !peterson_locks[lock_id].active)
        return -1;

    struct PetersonLock *lk = &peterson_locks[lock_id];

    // Withdraw interest: atomic release
    __sync_synchronize();
    __sync_lock_release(&lk->intrested[role]);
    __sync_synchronize();

    return 0;
}

int peterson_destroy(int lock_id){

    if (lock_id < 0 || lock_id >= NUM_PETERSON_LOCKS || !peterson_locks[lock_id].active)
        return -1;
    
    // Reset fields
    peterson_locks[lock_id].intrested[0] = 0;
    peterson_locks[lock_id].intrested[1] = 0;
    peterson_locks[lock_id].turn = 0;
    peterson_locks[lock_id].active = 0;

    // Return ID to free-list
    free_ids[free_count++] = lock_id;
    return 0;
}
