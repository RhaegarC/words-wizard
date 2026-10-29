/**
 * The slice of the D1 binding the Worker uses. Declared structurally so the
 * worker project does not depend on `@cloudflare/workers-types`: every method
 * below is the documented D1 API, and `wrangler dev` provides the real object.
 */

export interface D1Result<T> {
  readonly results: T[]
  readonly success: boolean
}

export interface D1PreparedStatement {
  bind(...values: readonly unknown[]): D1PreparedStatement
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>
  first<T = Record<string, unknown>>(): Promise<T | null>
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement
}
