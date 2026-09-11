import { strict as assert } from "node:assert";
import { test } from "node:test";
import { LruCache } from "./lruCache";

test("LruCache evicts the least recently used entry", () => {
  const cache = new LruCache<string, number>(3);
  cache.set("first", 1);
  cache.set("second", 2);
  cache.set("third", 3);

  assert.equal(cache.get("first"), 1);
  cache.set("fourth", 4);

  assert.equal(cache.get("second"), undefined);
  assert.equal(cache.get("first"), 1);
  assert.equal(cache.get("third"), 3);
  assert.equal(cache.get("fourth"), 4);
});

test("LruCache replacement promotes an entry without evicting another entry", () => {
  const cache = new LruCache<string, number>(2);
  cache.set("first", 1);
  cache.set("second", 2);
  cache.set("first", 10);
  cache.set("third", 3);

  assert.equal(cache.get("first"), 10);
  assert.equal(cache.get("second"), undefined);
  assert.equal(cache.get("third"), 3);
});

test("LruCache supports deletion and clearing", () => {
  const cache = new LruCache<string, number>(2);
  cache.set("first", 1);
  cache.set("second", 2);

  assert.equal(cache.delete("first"), true);
  assert.equal(cache.get("first"), undefined);
  cache.clear();
  assert.equal(cache.get("second"), undefined);
});

test("LruCache rejects invalid capacities", () => {
  assert.throws(() => new LruCache(0), RangeError);
  assert.throws(() => new LruCache(1.5), RangeError);
});
