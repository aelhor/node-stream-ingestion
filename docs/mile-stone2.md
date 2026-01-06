
# 🌊 Milestone 2: Backpressure & Flow Control

## 🎯 The Goal
Prove that node-stream-ingestion protects the system's memory even when the Sink is much slower than the Source. You want to see "Flat Memory" despite a massive "Speed Mismatch."  

## 📚 What will be covered

- The Pull Model: Understanding how for await...of behaves as a "pull" mechanism.

- The highWaterMark: Learning about Node's internal buffer limits.

- TCP/Disk Throttling: Seeing how JavaScript can tell the OS to stop reading from the disk.

- Latency vs. Throughput: Understanding why a slow sink shouldn't cause a memory leak.


## 📋 The Milestone 
### Plan
1. The "Slow Sink" Implementation
Create a new Sink implementation that introduces an artificial delay (e.g., 50ms) in the write method. This simulates a slow database insert or a rate-limited API.

2. The Memory Monitoring Loop
In  previous tests (tests\benchmark\milestone1.ts), I measured memory at the start and the end. In this milestone, I need to measure memory during the transfer.

Why? Because if backpressure fails, the memory will spike in the middle of the process and potentially crash before the "End" metric is ever reached.

3. The Research Comparison
will compare two scenarios:

- Scenario A (Fast Source, Slow Sink): Using the current library.(Backpressure)

- Scenario B (The "Broken" Way): Simulating what happens if you pushed data into an array without waiting for the write to finish.(No Backpressure)

___________________________________________________________________________________

### How Backpressure Works
```TS
/*

*/
// It asks the source (Readable Stream) for a chunk.
// It waits for that chunk to arrive.
for await (const chunk of source) {
            // It enters the loop body and hits await sink.write(buf).
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

            // increment totalBytes += chunk.length
            totalBytes += buf.length

            //The loop execution freezes here. It will not go back to the top of the loop to ask the source for the next chunk until sink.write resolves.
            await sink.write(buf)
        }
```

4. What Happens in the "Background"?
While the code is "frozen" at await sink.write(buf), the source (the file on your disk) might still want to push data.

- Node.js has an internal buffer. The source will fill that buffer.

- Once that buffer reaches its limit (the highWaterMark), Node.js automatically tells the underlying OS kernel: "Stop reading from the disk for now."

- The file read literally pauses at the hardware/OS level.

___________________________________________________________________________________

5. The "Slow Sink" Test Result
Implemented a sink that waits 50ms:

- Memory: RAM will stay flat(<155MB). Because the loop waits for the 50ms, you only ever have one chunk in your JavaScript memory at a time.

- Stability: It will not crash. It will just take longer to finish.


### Run this mile stone test (backpressure)
1. create a test file run this to create 200MB file 
```cmd
    node ./node_modules/ts-node/dist/bin.js tests/benchmark/create-test-file.ts

```
2. choose teh verison by comenting one of those lines 
```TS
    //Execute :read 1gb file and write to slow sink
    await ingestStream(fs.createReadStream(FILE_PATH), slowSink)
    //  Execute // No backpressure
    await brokenIngestStream(fs.createReadStream(FILE_PATH), slowSink);

```
3. run the test 
```cmd
node --expose-gc ./node_modules/ts-node/dist/bin.js tests/benchmark/backpressure-test.ts
```

### Performance & Research Comparison  
In this stage, I explored how the library handles "Speed Mismatches"—situations where the Source (Disk) is much faster than the Sink (Database/API).

The Comparison: Controlled Flow vs. Unbounded Flow
I compared two versions of the ingestion engine:

Backpressure (The Library Implementation): Uses await sink.write(chunk) to pace the source.

Broken/Unbounded (The "Chaos" version): Removed the await, allowing the loop to fire writes without waiting.

| Feature | Backpressure (Controlled) | Unbounded (Broken) |
|----------|-------------|-------------|
| Execution Strategy | Sequential: Wait for Sink to finish before asking for more data. | Concurrent: Fire all writes as fast as the disk can read. |
| Memory Profile (RSS) | Flat (~155 MB): Only one or two chunks exist in RAM at a time. | Increasing (250MB - 300MB+): Data piles up in the Promise queue. |
| Throughput | Limited by the speed of the Sink. | Limited by the speed of the Source (Disk). |
| System Safety | High: Safe for multi-tenant servers. | Low: Risk of Out-of-Memory (OOM) crashes. |
| Downstream Impact | Respectful of the Sink's capacity. | """DDoS-ing"" the Sink with thousands of parallel requests." |



#### 🧠 Deep Dive: 
##### Awaiting vs. Blocking
A common misconception in Node.js is that "waiting" for a Promise blocks the server. I proved to myself that this is false.

1. Awaiting is Non-Blocking
Using await sink.write() inside the for await...of loop suspends the ingestion function, but it does not freeze the Event Loop.

Proof: During the "Slow Sink" test (50ms delay), my Heartbeat interval continued to log 💓 every 500ms.

Conclusion: The Event Loop was free to handle other tasks (like HTTP requests) while the ingestion was waiting for the Sink.

2.Why "Fast" isn't always "Better"
The "Broken" version finished the loop faster, but it left the system in a degraded state.

- Even though the loop ended, the process could not exit because thousands of setTimeout calls were still pending in the background.

- In a real-world scenario, this causes Event Loop Lag, making the entire server feel slow or unresponsive to other users because the Microtask queue is overloaded.. 


3. The Backpressure "Magic"
By awaiting the sink, I naturally trigger the Node.js High Water Mark (HWM). When the internal stream buffer fills up, Node.js tells the OS kernel to pause the physical disk read. This is the ultimate form of efficiency: hardware-level flow control managed by JavaScript.


##### Note (Intesrting thing happen in the Broken version [No backpressure])
- Testing with 1GB file and a slow sink that waits for 200 Ms for each write 
didn't make a the memory to Spike (to 1gb) but it stayed relatively flat (~300MB)

######  Why is memory still "relatively" flat?
In your "broken" version, you removed the await, but you are still using a Readable Stream via for await...of.

Node.js streams have an internal buffer limit highWaterMark (usually 64KB for file streams). Even if you don't await, the Readable stream has a small bit of internal "self-preservation." However, because you aren't awaiting the sink, you are essentially telling the source: "I've handled the data, give me more!" The reason your RSS is 250MB–300MB (instead of 1GB) is likely because:

- Garbage Collection (GC): Node is trying desperately to clean up the Buffer objects as the loop finishes, even though the setTimeout promises from your sink are still floating in the "Promise Land" (the Microtask queue).

- Internal Throttling: The fs.createReadStream can only read from your SSD/HDD so fas
    
######  Why it "finishes" very fast (The Illusion)
Logs show it "finished" quickly because the Loop finished.

The for await loop sprinted through the 1GB file because it didn't have to wait 50ms per chunk.

The Catch: The data hasn't actually been "processed" by the slow sink yet! You have thousands of setTimeout calls currently queued up in memory.

added a log stament at the end of the test to prove that 


### 🏁 Stage Conclusion
Efficiency is not just about speed; it is about resource management. My implementation ensures that the system remains stable and responsive, even when under heavy load or dealing with slow external services.