# 🎯 The Overall Goal
The goal of Milestone 3 is to ensure that ingestion engine is Atomic. Either the whole operation succeeds, or it fails and cleans up every single resource (closes file handles, destroys streams, and notifies the sink) so that the system returns to a clean state.


# 📋 The Milestone 3 Plan

1. The "Chaos Sink" (Simulating Disaster)
Create a specialized sink that is designed to fail. It will process exactly 10 chunks and then throw a "Database Connection Lost" error. This allows us to observe the engine's behavior during a mid-stream explosion.

2. Resource Destruction (The Cleanup)
When the sink fails, the for await loop will throw an error. However, the source (the ReadStream) might still be open in the background. implement code to explicitly call source.destroy() to ensure we aren't wasting CPU or memory on a dead process.


3. State Integrity (Abort vs. Finalize)
Must ensure that:
- If it fails, sink.abort(error) is called.
- If it fails, sink.finalize() is not called.
- If it succeeds, sink.finalize() is called and sink.abort() is not.



# Atomic Ingestion & Resource Integrity

## The Problem
In distributed systems, failures are inevitable. A "Happy Path" implementation often suffers from **Resource Leaks**:
- If the Database (Sink) crashes, the File (Source) stays open.
- If the Ingestion fails validation, the stream handles are never released.
- If the Abort logic fails, the system hangs in an inconsistent state.

## Key Research & Implementation

### 1. The "Chaos Sink" Pattern
I implemented a testing pattern using a "Chaos Sink"—a mock destination designed to explode mid-stream. This allowed me to verify that:
- `sink.abort(err)` is called immediately upon any failure.
- `sink.finalize()` is never reached if an error occurs.
- The error is correctly re-thrown to the caller for high-level handling.

### 2. Guarded Validation
I identified a "Validation Leak" where an invalid configuration could cause the engine to crash before the `try/catch` logic could protect the resources. 
**Solution:** Refactored the engine to ensure that even if parameters are invalid, the `source` stream is explicitly destroyed in a `finally` block.

### 3. Error Magnetism
By utilizing the `for await...of` loop, the engine acts as an "Error Magnet." It automatically catches:
- **Source Errors:** (e.g., Network disconnects, File system errors).
- **Processing Errors:** (e.g., Memory issues, Logic bugs).
- **Sink Errors:** (e.g., Database timeouts).

## Trade-offs & Logic
- **Manual vs. Automatic Cleanup:** While `for await` handles iterator cleanup, I added an explicit `source.destroy()` in the `finally` block to guarantee closure in edge cases where the iterator might not have started or was interrupted by validation logic.
- **Abort Safety:** Added a safety check inside the `catch` block to ensure that if `sink.abort` itself fails, it doesn't swallow the original "root cause" error.

## Success Metrics
- [x] **0 Leaked File Descriptors:** Verified via TDD.
- [x] **100% Resource Cleanup:** Even on invalid input.
- [x] **Atomic State:** Sink is always notified of failure.

run test 
```bash
npm run build:test

node --test dist-tests/tests/choas-sink.spec.js
```