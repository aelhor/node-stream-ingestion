import fs from "node:fs";
import { performance } from "node:perf_hooks";
import { IngestionSink } from "../../sinks";
import { ingestStream } from "../ingestStream";

const FILE_PATH = "./large_file_2.bin";

function rssMB() {
    return Math.round(process.memoryUsage().rss / 1024 / 1024);
}

async function run() {
    global.gc?.();
    const startMemory = rssMB();
    const startTime = performance.now();

    let received = 0;
    let finalized = false;
    let aborted = false;
    let abortError: Error | undefined;
    let checksum = 0;

    const sink: IngestionSink = {
        async write(chunk: Buffer) {
            received += chunk.length;
            // Simulate a sink (force memory touch) by xor'ing each byte in the chunk into the checksum
            for (let i = 0; i < chunk.length; i += 4096) {
                checksum ^= chunk[i];
            }
        },
        async finalize() {
            finalized = true;
        },
        async abort(error: Error) {
            aborted = true;
            abortError = error;
        }
    };

    console.log("RSS before read:", startMemory, "MB");

    const readStream = fs.createReadStream(FILE_PATH);
    const result = await ingestStream(readStream, sink);

    if (result.totalBytes !== received) {
        throw new Error(
            `Byte count mismatch: ingestStream=${result.totalBytes} sinkReceived=${received}`
        );
    }
    if (!finalized) {
        throw new Error("Sink did not finalize");
    }
    if (aborted) {
        throw new Error("Sink aborted during ingestion");
    }

    const endTime = performance.now();
    const endMemory = rssMB();

    console.log("Checksum:", checksum);
    console.log("RSS after read:", endMemory, "MB");
    console.log("Delta RSS:", endMemory - startMemory, "MB");
    console.log("Elapsed:", Math.round(endTime - startTime), "ms");
}

run().catch((err) => {
    console.error("❌ ingestion test failed");
    console.error(err);
    process.exit(1);
});

