import { Readable } from "node:stream";
import assert from "node:assert";
import { ingestStream } from "../src/core/ingestStream";
import { IngestionSink } from "../src/sinks/IngestionSink";

async function run() {
  const received: Buffer[] = [];
  let finalized = false;
  let aborted = false;

  const sink: IngestionSink = {
    async write(chunk: Buffer) {
      received.push(chunk);
    },
    async finalize() {
      finalized = true;
    },
    async abort() {
      aborted = true;
    }
  };

  const source = Readable.from([
    Buffer.from("a"),
    Buffer.from("b")
  ]);

  const result = await ingestStream(source, sink);

  // assertions
  assert.strictEqual(received.map(b => b.toString()).join(""), "ab");
  assert.strictEqual(finalized, true);
  assert.strictEqual(aborted, false);
  assert.strictEqual(result.totalBytes, 2);

  console.log("✅ ingestion test passed");  
}

run().catch(err => {
  console.error("❌ ingestion test failed");
  console.error(err);
  process.exit(1);
});
