import { signal } from '@angular/core';

/** Keeps what the page shows, and the actions that change it. */
@Injectable({ providedIn: 'root' })
export class Store {
  /** The mode: plain or developer. */
  readonly mode = signal('plain');
  private count = 1;

  /** Opens one item. */
  @Trace() async open(id: string, extra?: number): Promise<void> { }

  close(): void { }

  handler = (e: Event) => { };
}

export interface Api {
  get(id: string): void;
  name: string;
}

/** Adds one to a number. */
export function increment(value: number): number { return value + 1; }

export const double = (value: number) => value * 2;

function undocumented() { }
