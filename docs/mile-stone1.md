# Milestone 1 – Minimal Stream Ingestion Core

## Goal

Establish a **minimal, correct, and extensible core** for stream ingestion that:

- Reads data from a Node.js `Readable` stream
- Forwards data to a user-defined sink
- Tracks basic ingestion metadata
- Handles lifecycle correctly (success & failure)
- Is easy to reason about and test

This milestone intentionally avoids complexity (backpressure tuning, workers, transforms, metrics) to ensure a solid foundation.

## What Was Added

### 1. `ingestStream` Core Function

A single async function that orchestrates ingestion:

```ts
ingestStream(source, sink, options?) → Promise<IngestionResult>
```

Responsibilities:

- Validate required inputs
- Consume the source stream using async iteration
- Forward chunks to the sink
- Track total bytes and duration
- Finalize on success
- Abort on failure

This function acts as the composition root for the ingestion pipeline.

### 2. Sink Contract (IngestionSink)

A minimal interface defining the sink lifecycle:

```ts
write(chunk: Buffer): Promise<void>
finalize(): Promise<void>
abort(error: Error): Promise<void>
```

This design:

- Decouples ingestion from storage/output concerns
- Allows multiple sink implementations (FS, HTTP, DB, etc.)
- Keeps the core logic framework-agnostic

### 3. Default File System Sink (createFsSink)

A built-in sink that writes data to disk using Node.js streams.

Purpose:

- Provide an out-of-the-box experience for users
- Enable immediate real-world usage
- Serve as a reference implementation for custom sinks

This sink respects the same lifecycle contract as any user-defined sink.

### 4. Basic Validation

Input validation ensures:

- A source stream is provided
- The sink implements the required lifecycle methods

Validation is kept simple and synchronous to fail fast and avoid undefined runtime behavior.

### 5. Integration Test Coverage

Tests verify:

- Successful ingestion flow
- Correct data writing to disk
- Proper finalization
- Clean resource handling

The tests intentionally validate integration behavior, not internal implementation details.

## Key Design Decisions

### Functional Core (No Classes)

The ingestion logic is implemented as a pure async function, not a class.

Reasons:

- Easier to test
- Fewer hidden states
- More flexible composition
- Avoids premature abstraction

Object-oriented patterns can be introduced later if real constraints appear.

### Explicit Lifecycle Management

Rather than relying on implicit stream events:

- Lifecycle transitions are explicit (write → finalize | abort)
- Error handling is centralized
- Cleanup behavior is predictable

This is critical for long-running or production ingestion jobs.

### Minimal Scope by Design

This milestone does not include:

- Backpressure tuning
- Parallelism or workers
- Transforms
- Observability or metrics
- Graceful shutdown

These concerns are intentionally deferred to avoid coupling and over-design.

## Limitations (Known & Accepted)

- Backpressure handling is basic
- Single-threaded ingestion
- No cancellation or abort signal
- No retry logic

These are acceptable tradeoffs for establishing correctness first.

### Performance

The baseline implementation is not optimal for performance. It reads the entire file into memory and then writes it to disk. This is not a good use of memory and it is not a good use of disk space. It is also not a good use of CPU.

The streaming comparison shows that the streaming approach is much more memory efficient and.
``` CMD
node --expose-gc ./node_modules/ts-node/dist/bin.js src/core/benchmarks/baseline.ts
```
The Result is:
```text
RSS before read: 179 MB
Checksum: 81
RSS after read: 1180 MB
Delta RSS: 1001 MB     
Elapsed: 715 ms        
```

``` CMD
node --expose-gc ./node_modules/ts-node/dist/bin.js src/core/benchmarks/streaming_comparison.ts
```
The Result is:
```text

RSS before read: 180 MB
Checksum: 81
RSS after read: 193 MB
Delta RSS: 13 MB      
Elapsed: 2210 ms      
```

#### Note : 
    - using buffer of all zeros to simulate a real file will make the checksum always zero.
    - using random bytes will make the checksum random.
        - if the checksum is not the same, it means that the data was not written correctly.


#### compasison between baseline using fs.readFile (Async) vs fs.readFileSync vs streaming comparison using ingestStream
| Method        | Strategy           | Memory Profile | Blocking?       |
|---------------|--------------------|----------------|-----------------|
| readFileSync  | Synchronous Buffering | High (File size) | Yes (Freezes the whole app) |
| readFile      | Asynchronous Buffering | High (File size) | No (Event loop stays free) |
| ingestStream  | Streaming          | Low (Constant) | No (Event loop stays free) |

#### Performance & Memory Research
To validate the efficiency of node-stream-ingestion, three data-handling strategies were benchmarked using a 1GB file containing random bytes.Important: Tests were executed in separate processes to ensure memory heap measurements did not overlap or interfere with each other.How to Run Benchmarks

```CMD
Test 1: Synchronous Buffering (The "Naive" way)
node --expose-gc ./node_modules/ts-node/dist/bin.js tests/benchmark/milestone1.ts 1
```

```CMD
Test 2: Asynchronous Buffering (Non-blocking, but memory-heavy)
node --expose-gc ./node_modules/ts-node/dist/bin.js tests/benchmark/milestone1.ts 2
```

```CMD
Test 3: Streaming Ingestion (The "node-stream-ingestion" way)
node --expose-gc ./node_modules/ts-node/dist/bin.js tests/benchmark/milestone1.ts 3
```
##### Benchmark Results (1GB Payload)
| Method        | RSS Delta (Peak RAM) | Time (ms) | Data Integrity (Checksum) | Strategy |
|---------------|----------------------|-----------|---------------------------|----------|
| readFileSync  | 1002 MB              | 876 ms    | 155                       | Buffering (Blocking) |
| readFile      | 1003 MB              | 998 ms    | 155                       | Buffering (Async) |
| ingestStream  | 14 MB                | 2157 ms   | 155                       | Streaming (Safe) |

Memory Efficiency: ingestStream used 98.6% less RAM than the buffering approaches. While buffering scales linearly with file size (eventually crashing the process), streaming remains constant.

The Trade-off: Streaming is slower in raw execution time due to chunking overhead and context switching. However, it provides Time-to-First-Byte (TTFB) advantages, as the sink begins processing data immediately rather than waiting for the full 1GB to load.

Data Integrity: All methods produced the same Checksum (155), proving the streaming engine is reliable and zero-loss.

## What’s Next – Milestone 2

Milestone 2 will focus on controlled flow and safety, including:

- Explicit backpressure handling
- Sink write throttling
- Abort signaling (e.g. AbortController)
- Safer shutdown semantics
- Stress testing with slow sinks

This will build directly on the stable core introduced in Milestone 1.

## Summary

Milestone 1 delivers a small but solid ingestion core that:

- Works end-to-end
- Is easy to extend
- Makes lifecycle guarantees explicit
- Sets a clean foundation for advanced features

Future milestones will add power without compromising clarity.

## Reviewer note (mentor feedback)

This document shows:

- clear scope control
- strong architectural thinking
- respect for future contributors

You’re building this like a **real OSS library**, not a demo.

When you’re ready, we’ll move to **Milestone 2: backpressure & flow control**, which is where things get interesting 😄