/**
 * Runtime shims for the ES2022 built-ins this space and its CDN dependencies
 * call unguarded. Every shim is feature-detected, so on an up-to-date engine
 * this module installs nothing.
 *
 * A large share of VicharakAI's students open the app on budget Android
 * handsets whose Chrome never moved past 2021, and two built-ins land after
 * that line:
 *
 *   - `Array.prototype.at` / `String.prototype.at` shipped in Chrome 92, so any
 *     `value.at(i)` reaching those devices throws "at is not a function".
 *   - `Object.hasOwn` shipped in Chrome 93. react-markdown 9 (the renderer
 *     behind the agent chat) calls it on every render without a guard, so the
 *     whole chat surface throws there.
 *
 * `Array.prototype.findLast` / `findLastIndex` (Chrome 97) are covered too so
 * the same class of failure cannot come back through a later edit.
 *
 * Import this module for its side effect, ahead of everything else, at each
 * entry point: Desktop.tsx, components/EmailGate.tsx, apps/VicharakAI/App.tsx.
 */

type Indexed = ArrayLike<unknown>;
type Predicate = (value: unknown, index: number, collection: unknown) => unknown;

function install(target: object, name: string, value: unknown): void {
  if (typeof (target as Record<string, unknown>)[name] === 'function') return;
  try {
    Object.defineProperty(target, name, {
      value,
      writable: true,
      configurable: true,
      enumerable: false,
    });
  } catch {
    /* A frozen prototype is not worth crashing the app over. */
  }
}

function requireCallable(candidate: unknown): asserts candidate is Predicate {
  if (typeof candidate !== 'function') {
    throw new TypeError(String(candidate) + ' is not a function');
  }
}

/* Shared by arrays and strings — `Object(this)` makes both index the same way. */
function at(this: unknown, index: number): unknown {
  const self = Object(this) as Indexed;
  const length = self.length >>> 0;
  // `|| 0` folds NaN (and -0) to 0, matching ToIntegerOrInfinity.
  let offset = Math.trunc(Number(index)) || 0;
  if (offset < 0) offset += length;
  return offset < 0 || offset >= length ? undefined : self[offset];
}

function findLast(this: unknown, predicate: Predicate, thisArg?: unknown): unknown {
  requireCallable(predicate);
  const self = Object(this) as Indexed;
  for (let index = (self.length >>> 0) - 1; index >= 0; index -= 1) {
    if (predicate.call(thisArg, self[index], index, self)) return self[index];
  }
  return undefined;
}

function findLastIndex(this: unknown, predicate: Predicate, thisArg?: unknown): number {
  requireCallable(predicate);
  const self = Object(this) as Indexed;
  for (let index = (self.length >>> 0) - 1; index >= 0; index -= 1) {
    if (predicate.call(thisArg, self[index], index, self)) return index;
  }
  return -1;
}

function hasOwn(target: unknown, property: PropertyKey): boolean {
  if (target === null || target === undefined) {
    throw new TypeError('Cannot convert undefined or null to object');
  }
  return Object.prototype.hasOwnProperty.call(Object(target), property);
}

install(Array.prototype, 'at', at);
install(String.prototype, 'at', at);
install(Array.prototype, 'findLast', findLast);
install(Array.prototype, 'findLastIndex', findLastIndex);
install(Object, 'hasOwn', hasOwn);

export {};
