/**
 * Joins two names with a dash.
 * @param {string} a the first
 * @param {string} b the second
 */
export function join(a, b) { return `${a}-${b}`; }

export class Counter {
  tick() { return 1; }
}
