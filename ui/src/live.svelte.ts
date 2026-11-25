// The guard's status for every screen of this host outside its own page: the
// dashboard card, the printer's Status section and the line on the printer's
// card. It is read once however many of them show it, and read again when the
// core says something happened that changes it, so a wall of cards costs one
// request per stored snapshot and polls nothing of its own.
import type { ModuleHost } from '@prusa/connect-ui/slots';

import { guardOn, type Incident, type Status, type Watch } from './guard';

// A camera stored a snapshot: the guard scores it next. A print started or
// settled: the guard follows or lets go of the printer. A stream that lost its
// place may have missed either.
const SNAPSHOT_CAPTURED = 'com.prusa.connect.camera.snapshot.captured';
const JOB_STARTED = 'com.prusa.connect.device.job.started';
const JOB_SETTLED = 'com.prusa.connect.device.job.settled';
const CONTINUITY_LOST = 'com.prusa.connect.stream.continuity.lost';

// The guard scores a snapshot after the event that announced it, and Obico
// takes a few seconds to answer, so the status is read once the score is in.
// Events that arrive inside the wait share one read.
const SETTLE_MS = 6_000;

export type LiveState =
  | { kind: 'loading' }
  | { kind: 'error'; thrown: unknown }
  | { kind: 'ready'; status: Status; incidents: Incident[] };

export class Live {
  #state = $state.raw<LiveState>({ kind: 'loading' });
  #attempt = 0;
  #pending: ReturnType<typeof setTimeout> | undefined;
  readonly #guard: ReturnType<typeof guardOn>;
  readonly #signal: AbortSignal;

  constructor(host: ModuleHost) {
    this.#guard = guardOn(host);
    this.#signal = host.signal;
    this.#signal.addEventListener(
      'abort',
      () => {
        clearTimeout(this.#pending);
      },
      { once: true },
    );
    void this.#read();
    void this.#follow(host);
  }

  get state(): LiveState {
    return this.#state;
  }

  /** The camera the guard follows on a printer, when it follows one. */
  watchOf(printer: string): Watch | undefined {
    return this.#state.kind === 'ready'
      ? this.#state.status.cameras.find((watch) => watch.printer === printer)
      : undefined;
  }

  /** The newest incident on a printer, when it has one. */
  incidentOf(printer: string): Incident | undefined {
    return this.#state.kind === 'ready'
      ? this.#state.incidents.find((incident) => incident.printer === printer)
      : undefined;
  }

  /** Reads the status again now, for a screen that just acted on it. */
  refresh(): void {
    clearTimeout(this.#pending);
    this.#pending = undefined;
    void this.#read();
  }

  async #read(): Promise<void> {
    const attempt = ++this.#attempt;
    try {
      const [status, incidents] = await Promise.all([
        this.#guard.status(this.#signal),
        this.#guard.incidents(this.#signal),
      ]);
      if (attempt === this.#attempt)
        this.#state = { kind: 'ready', status, incidents };
    } catch (thrown: unknown) {
      // A read that fails after one succeeded keeps the last status on
      // screen: a card that blinks to an error on every hiccup reads worse
      // than one that is a few seconds old.
      if (
        attempt === this.#attempt &&
        !this.#signal.aborted &&
        this.#state.kind !== 'ready'
      )
        this.#state = { kind: 'error', thrown };
    }
  }

  #soon(): void {
    if (this.#pending !== undefined || this.#signal.aborted) return;
    this.#pending = setTimeout(() => {
      this.#pending = undefined;
      void this.#read();
    }, SETTLE_MS);
  }

  async #follow(host: ModuleHost): Promise<void> {
    const subscription = host.client.events({
      types: [SNAPSHOT_CAPTURED, JOB_STARTED, JOB_SETTLED, CONTINUITY_LOST],
      signal: this.#signal,
    });
    try {
      // The subscription carries only the types that call for a re-read.
      const events = subscription[Symbol.asyncIterator]();
      while (!(await events.next()).done) this.#soon();
    } catch {
      // The SDK subscription reconnects by itself. A stream that throws anyway
      // leaves the last read on screen.
    }
  }
}

const shared = new WeakMap<ModuleHost, Live>();

/** The one status this host's screens share. */
export const liveFor = (host: ModuleHost): Live => {
  let live = shared.get(host);
  if (live === undefined) {
    // Built under its own root: the first screen to ask is not the owner, and
    // state owned by a screen goes inert when that screen is destroyed.
    let created!: Live;
    const dispose = $effect.root(() => {
      created = new Live(host);
    });
    host.signal.addEventListener('abort', dispose, { once: true });
    live = created;
    shared.set(host, live);
  }

  return live;
};
