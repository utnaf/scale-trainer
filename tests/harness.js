// Mini harness di test eseguito nel browser (tests/index.html).

export const results = [];

export function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (e) {
    results.push({ name, ok: false, error: e.message });
  }
}

export function assertEqual(actual, expected) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`atteso ${b}, ottenuto ${a}`);
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}
