/**
 * The slice of the D1 binding the Worker uses. Declared structurally so the
 * worker project does not depend on `@cloudflare/workers-types`: every method
 * below is the documented D1 API, and `wrangler dev` provides the real object.
 */

export interface D1Meta {
  /** Rows written by the statement; the idempotency guards read this. */
  readonly changes?: number
  readonly last_row_id?: number
}

export interface D1Result<T> {
  readonly results: T[]
  readonly success: boolean
  readonly meta?: D1Meta
}

export interface D1PreparedStatement {
  bind(...values: readonly unknown[]): D1PreparedStatement
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>
  first<T = Record<string, unknown>>(): Promise<T | null>
  run(): Promise<D1Result<unknown>>
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement
  /**
   * Runs the statements as one transaction: either every write lands or none
   * does. The session commit depends on that and on the statements' order,
   * because `changes()` reports the statement immediately before it.
   */
  batch<T = Record<string, unknown>>(
    statements: readonly D1PreparedStatement[],
  ): Promise<D1Result<T>[]>
}
