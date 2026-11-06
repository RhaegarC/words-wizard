/**
 * The slice of the R2 binding the avatar routes use.
 *
 * Declared structurally, like `db/d1.ts`, so the Worker compiles without
 * `@cloudflare/workers-types` and a test can pass a stand-in that is a real
 * object store's shape rather than a fake of our own contract.
 */

export interface R2HttpMetadata {
  readonly contentType?: string
  readonly cacheControl?: string
}

export interface R2ObjectBody {
  readonly body: ReadableStream
  readonly httpMetadata?: R2HttpMetadata
}

export interface R2PutOptions {
  readonly httpMetadata?: R2HttpMetadata
}

export interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>
  put(
    key: string,
    value: ArrayBuffer | Uint8Array,
    options?: R2PutOptions,
  ): Promise<unknown>
  delete(key: string): Promise<void>
}
