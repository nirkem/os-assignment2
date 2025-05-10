// Tal
#pragma once // Prevent multiple inclusions of this header file
#define NUM_PETERSON_LOCKS 15

// Peterson lock struct
struct PetersonLock {
    int intrested[2];     // Indicate if a thread is interested in entering the critical section
    int turn;            // Indicate which thread's turn it is to enter the critical section
    int active;         // Indicate if the lock is free to use
};

// Global array of Peterson locks
extern struct PetersonLock peterson_locks[NUM_PETERSON_LOCKS];

// PetersonLock API
int peterson_init(void);
int peterson_create(void);
int peterson_acquire(int lock_id, int role);
int peterson_release(int lock_id, int role);
int peterson_destroy(int lock_id);

