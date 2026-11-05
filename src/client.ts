/** Small interface to the factory. Injected into the server; faked in tests. */

/** A run is addressed the way the factory addresses it: repo and issue. */
export interface RunRef {
  repo: string;
  issue: string;
}

export interface WatchInput {
  /** How long to listen, in seconds. */
  seconds: number;
  /** Stop early after this many events. */
  maxEvents: number;
}

/**
 * Bodies of the read routes below are passed through as the route returned
 * them; the client does not reshape them.
 */
export interface FactoryClient {
  /** GET /api/repos */
  listRepos(): Promise<unknown>;
  /** GET /api/runs */
  listRuns(): Promise<unknown>;
  /** GET /api/runs/{repo}/{issue} */
  getRun(ref: RunRef): Promise<unknown>;
  /** GET /api/runs/{repo}/{issue}/events */
  listEvents(ref: RunRef): Promise<unknown>;
  /** GET /api/spend */
  spend(): Promise<unknown>;
  /** GET /api/metrics */
  getMetrics(): Promise<unknown>;
  /** GET /api/events, read for a bounded time; returns the events that arrived. */
  watchEvents(input: WatchInput): Promise<unknown[]>;
}
