/**
 * Codecs for usePersistentState — pure (React-free) so they can be unit-tested
 * without a DOM/React environment. Each codec is { parse(raw)->value,
 * serialize(value)->string }. `parse` may return undefined to signal "fall back
 * to the default value".
 */

export const jsonCodec = {
  parse: (raw) => JSON.parse(raw),
  serialize: (v) => JSON.stringify(v),
};

/** Boolean stored as 'on' | 'off'. */
export const onOffCodec = {
  parse: (raw) => raw === 'on',
  serialize: (v) => (v ? 'on' : 'off'),
};

/** Boolean where anything except the literal 'off' is true (on-by-default). */
export const onUnlessOffCodec = {
  parse: (raw) => raw !== 'off',
  serialize: (v) => (v ? 'on' : 'off'),
};

/** A plain string stored verbatim. */
export const stringCodec = {
  parse: (raw) => raw,
  serialize: (v) => String(v),
};

/** Number codec with validation; returns undefined (→ default) if the parsed
 *  value isn't finite or fails the optional predicate. */
export function numberCodec({ int = false, valid } = {}) {
  return {
    parse: (raw) => {
      const n = int ? parseInt(raw, 10) : parseFloat(raw);
      if (!Number.isFinite(n)) return undefined;
      if (valid && !valid(n)) return undefined;
      return n;
    },
    serialize: (v) => String(v),
  };
}
