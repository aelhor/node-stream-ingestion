## Goal : 
- care about Observability 📊 and Deterministic Control 🛑. Milestone 4 is all about moving from a system that only reacts to internal errors to one that can be controlled from the outside.

- The Goal: Cancellation & Abort Observability
We need to handle the case where a user cancels an upload, a network request times out, or our system needs to shut down gracefully


## Plan 

### Step 1: External Control via AbortSignal 📡
- We need to allow the consumer to tell us when to stop.

- The Plan: Modify our IngestionOptions to accept an AbortSignal.

- The Decision: Why use AbortSignal? It’s the web-standard way to cancel asynchronous operations in Node.js and the browser.


### Step 2: The "Immediate Kill" (Interrupt) ⚡
- Checking for cancellation only at the start of the loop isn't enough. If sink.write is hanging on a slow database, we need to break out immediately.

- The Plan: Implement an event listener on the signal that destroys the source stream as soon as the abort event fires.

- The Decision: This ensures we don't leak resources or keep the event loop busy while waiting for a task that is already cancelled.


### Step 3: Result Observability & Status Tracking 📈
- Our return type currently only returns bytes and duration. We need to know how it ended.

- The Plan: Update IngestionResult to include a status (success, aborted, or failed) and potentially the error object.

- The Decision: This allows the calling service to distinguish between a "hard crash" and a "user cancellation" for better logging and metrics.


### Step 4: Prevention of Listener Leaks 💧
- Every time we add an event listener, we risk a memory leak if we don't clean it up.

- The Plan: Ensure the abort listener is removed in the finally block.

- The Decision: This ensures we don't leave behind event listeners that could prevent the garbage collector from reclaiming memory.