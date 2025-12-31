import { createWriteStream, WriteStream } from "node:fs";
import { IngestionSink } from "./IngestionSink";

export function createFsSink(path: string): IngestionSink {
  const stream: WriteStream = createWriteStream(path);

  return { 
    
    async write(chunk: Buffer) {
      /**
       * stream.write(...) returns:
       * true if it’s okay to keep writing immediately
       * false if the internal buffer is full (backpressure) and you should wait for "drain"
       */
      if (!stream.write(chunk)) {
        await new Promise(res => stream.once("drain", res));
      }
    },

    async finalize() {
      await new Promise(res => stream.end(res));
    },

    async abort(err: Error) {
      stream.destroy(err);
    }
  };
}
