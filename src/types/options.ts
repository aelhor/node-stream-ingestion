export interface IngestionOptions {
    signal?: AbortSignal
    // optional transform function to process each chunk
    transform?: (chunk: Buffer) => Buffer | Promise<Buffer | null> | null
}
