/** Monotonic timestamps in milliseconds; the estimator is planned for Phase 8. */
export interface ClockSample {
  readonly clientSentAtMs: number;
  readonly serverReceivedAtMs: number;
  readonly serverSentAtMs: number;
  readonly clientReceivedAtMs: number;
  readonly serverEpoch: string;
}

export interface ClockEstimate {
  readonly offsetMs: number;
  readonly roundTripMs: number;
  readonly uncertaintyMs: number;
  readonly serverEpoch: string;
}
