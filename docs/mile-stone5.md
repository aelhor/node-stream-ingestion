# Design Document: Milestone 5 – Extensibility & Transformation
## 1. Overview
This milestone transitions the engine from a pure "data mover" to a "data processor." We are introducing a Transformation Hook that allows users to modify, sanitize, or filter data chunks in flight.


## 2. Issues and how we fixed them
### Issue 1: Supporting Optional Transformation

**The Problem:** Clients often need to manipulate data before it reaches the sink (e.g., masking PII, compression, or adding metadata). Without a built-in hook, users are forced to wrap the engine in complex custom logic, losing the "Water-Tight" safety we built in Milestone 4.

**Real-World Example (Log Sanitization):**
A client ingesting server logs needs to mask all Email Addresses before storing them in a database to comply with GDPR.


```typescript
// Pseudo-code:

const sanitizeTransform = (chunk) => {
    const content = chunk.toString();
    // Replace emails with [MASKED]
    const sanitized = content.replace(/[a-z0-9]+@[a-z]+\.[a-z]{2,3}/g, "[MASKED]");
    return Buffer.from(sanitized);
};
```

**The Approach** (Approach 1 - Serial Async Hook):
We update the core loop to await a transform function. This preserves Backpressure because the engine will not pull the next chunk from the source until the current chunk is transformed and written.
___________________________________________________________

### Issue 2: Weakened Abort Responsiveness
**The Problem:** Because JavaScript is single-threaded, a CPU-intensive transformation (like encrypting a large chunk) "blocks" the Event Loop. If a user clicks "Cancel," the AbortSignal listener cannot run because the CPU is too busy doing math. The "Emergency Brake" we built in Milestone 4 becomes laggy.

**The Fix:** Internal Yielding
We will implement "Yielding" inside the orchestration loop. After a transformation is completed, the engine will manually "take a breath."

**Mechanism:**

```typescript
// After transformation, we yield control back to the Node.js Event Loop
await new Promise(resolve => setImmediate(resolve));
```

**Why:** This allows the CPU to process the abort event in the queue before starting the next chunk. It ensures the process stops "now" rather than "whenever the math finishes."

___________________________________________________________

### Issue 3: Performance Bottlenecks (The "Speed" Problem)
**The Problem:** Performing heavy transformations (like AES-256 encryption) serially makes the total ingestion time significantly longer. The CPU becomes the bottleneck, not the network.

**The Fix:** Worker Threads (Tag: [MILESTONE 6])
In the next milestone, we will offload the transform function to a Worker Thread Pool. This allows the main engine to stay responsive while secondary CPU cores handle the heavy lifting in parallel.

___________________________________________________________

| Milestone | Focus | Tech Strategy | Result |
|-----------|-------|--------------|--------|
| MS 4 (Done) | Resilience | AbortSignal + onAbort | Safe "Cancel" for I/O |
| MS 5 (Current) | Extensibility | async transform() + Internal Yield | Engine can now Encrypt/Filter |
| MS 6 | Performance | Worker Thread Pool | High-speed processing on multiple cores |