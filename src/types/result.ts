/**
 * @interface IngestionResult
 * @property {number} totalBytes - The total number of bytes ingested.
 * @property {number} duration - The duration of the ingestion process in milliseconds.
 * @property {string} status - The status of the ingestion process.
 * @property {Error} error - The error that occurred during the ingestion process.
 * 
 * Status :string
 * success: Ingestion finished naturally (end of stream).
 * aborted: The AbortSignal was triggered mid-process.
 * failed: An unexpected error occurred (e.g., source stream crash).
 */
export interface IngestionResult {
  totalBytes: number
  duration: number
  status?: 'success' | 'aborted' | 'failed'
  error?: Error
}

