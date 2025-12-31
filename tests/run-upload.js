console.log("Running upload smoke test...");

const { createIngestStream } = require('../dist/index.js');

async function main() {
  const ingest = createIngestStream();
  if (ingest && typeof ingest.runSmokeTest === 'function') {
    await ingest.runSmokeTest();
  }
  console.log("Test complete");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
