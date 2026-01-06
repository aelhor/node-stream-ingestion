import { randomBytes } from "crypto";
import fs from "fs";
import { performance } from "perf_hooks";

const FILE_PATH = "./test_file_10mb.bin";
const TOTAL_SIZE = 200 * 1024 * 1024;
const CHUNK_SIZE = 1024 * 1024;

function createLargeFile() {
  fs.writeFileSync(FILE_PATH, "");

  let written = 0;

  while (written < TOTAL_SIZE) {
    const remaining = TOTAL_SIZE - written;
    const size = Math.min(CHUNK_SIZE, remaining);
    const chunk = randomBytes(size);
    fs.appendFileSync(FILE_PATH, chunk);
    written += size;
  }
}

const start = performance.now();
createLargeFile();
const end = performance.now();

console.log("Created:", FILE_PATH);
console.log("Size:", fs.statSync(FILE_PATH).size, "bytes");
console.log("Elapsed:", Math.round(end - start), "ms");
