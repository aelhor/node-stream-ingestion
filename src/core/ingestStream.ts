/**
- Orchestrates the ingestion lifecycle
- Owns the ingestion loop
- Applies backpressure by awaiting sink writes
Why
    - Centralizing control avoids fragmented flow logic
    - Makes correctness provable
*/
import { IngestionOptions } from "../types/options";
import { IngestionResult } from "../types/result";
import { Readable } from "node:stream";
import { IngestionSink } from "../sinks/IngestionSink";


/**
 * ingestStream reliably moves data from a readable stream to a sink,
 * while owning the lifecycle, ordering, and metrics.
 * Without ingestStream, every project ends up writing this logic badly:
    - forgetting to handle stream errors
    - writing chunks out of order
    - leaking resources on failure
    - having no idea how many bytes were processed
    - duplicating lifecycle logic everywhere
    ingestStream centralizes this once, correctly.
    @param source - Readable stream to ingest
    @param sink - user-provided destination
    @param options? - Ingestion options
 */



function validateIngestionParams(source: Readable, sink: IngestionSink) {
    if (!source) {
        throw new Error("source is required");
    }
    if (!sink) {
        throw new Error("sink is required");
    }
    if (!sink.abort || !sink.finalize || !sink.write) {
        throw new Error("sink must implement all required methods");
    }
}
export async function ingestStream(
    source: Readable,
    sink: IngestionSink,
    options?: IngestionOptions
): Promise<IngestionResult> {
    try {
        validateIngestionParams(source, sink)

        const startTime = new Date()
        let totalBytes = 0

        // Read & forward chunks
        // the loop naturally pauses until the await sink.write(buf) promise resolves.
        for await (const chunk of source) {
            // ensure chunk is Buffer
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);

            // increment totalBytes += chunk.length
            totalBytes += buf.length

            // await sink.write(chunk)
            await sink.write(buf)
        }

        // Finalize
        await sink.finalize()
        const endTime = new Date()
        const durationMs = endTime.getTime() - startTime.getTime()
        return {
            totalBytes,
            duration: durationMs,
        }
    }
    catch (error) {
        // Only attempt to abort if the sink is valid
        if (sink && typeof sink.abort === 'function') {
            try {
                await sink.abort(error as Error);
            } catch (abortError) {
                console.error("Critical: Sink failed to abort properly", abortError);
            }
        }
        throw error; // Always re-throw the original error
    }
    finally {
        // Explicit cleanup: Ensure source is destroyed even if validation failed
        // or if the loop didn't start.
        if (!source.destroyed) {
            source.destroy();
        }
    }
}