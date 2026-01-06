// Attempts to "ingest" a large file (try 1GB or 2GB) using fs.readFileSync.

// 1. Create a large dummy file (1GB+) using fs.writeFileSync in a loop
// 2. Wrap the execution in a function that records:
//   - startMemory = process.memoryUsage().rss
//   - startTime = performance.now()
// 3. Try to read the whole file: const data = fs.readFileSync('large_file')
// 4. "Simulate" a sink by doing something with 'data'
// 5. Log the Peak RSS (Resident Set Size)

import { randomBytes } from "crypto";
import fs from "fs";
import { performance } from "perf_hooks";

const FILE_PATH = "./large_file_2.bin";
const ONE_GB = 1024 * 1024 * 1024;
const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB

function rssMB() {
  return Math.round(process.memoryUsage().rss / 1024 / 1024);
}

function createLargeFile() {
  fs.writeFileSync(FILE_PATH, ""); // reset file

  let written = 0;
//   const chunk = Buffer.alloc(CHUNK_SIZE, 0);

  while (written < ONE_GB) {
    // use random bytes to simulate a real file 
    const chunk = randomBytes(CHUNK_SIZE);
    fs.appendFileSync(FILE_PATH, chunk);
    written += CHUNK_SIZE;
  }
}

function runExperiment() {
  global.gc?.(); // best-effort GC
  const startMemory = rssMB();
  const startTime = performance.now();

  console.log("RSS before read:", startMemory, "MB");

  // Read entire file into memory
  const data = fs.readFileSync(FILE_PATH);

  // Simulate a sink (force memory touch)
  let checksum = 0;
  for (let i = 0; i < data.length; i += 4096) {
    checksum ^= data[i];
  }

  const endTime = performance.now();
  const endMemory = rssMB();

  console.log("Checksum:", checksum);
  console.log("RSS after read:", endMemory, "MB");
  console.log("Delta RSS:", endMemory - startMemory, "MB");
  console.log("Elapsed:", Math.round(endTime - startTime), "ms");
}

// createLargeFile();
runExperiment();
