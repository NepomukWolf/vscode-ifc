import { strict as assert } from "node:assert";
import { test } from "node:test";
import { LinearHistory } from "./linearHistory";

test("LinearHistory supports browser-style back and forward traversal", () => {
  const history = new LinearHistory<number>(5);
  history.push(1);
  history.push(2);
  history.push(3);
  assert.equal(history.peekBack(), 2);
  history.commitBack();
  assert.equal(history.peekBack(), 1);
  assert.equal(history.peekForward(), 3);
  history.commitForward();
  assert.equal(history.peekBack(), 2);
});

test("LinearHistory ignores duplicates and truncates the forward branch", () => {
  const history = new LinearHistory<number>(5);
  history.push(1);
  history.push(2);
  history.push(2);
  history.commitBack();
  history.push(3);
  assert.equal(history.peekBack(), 1);
  assert.equal(history.canGoForward, false);
});

test("LinearHistory enforces its capacity", () => {
  const history = new LinearHistory<number>(3);
  for (let value = 1; value <= 5; value++) {
    history.push(value);
  }
  history.commitBack();
  history.commitBack();
  assert.equal(history.peekBack(), undefined);
  assert.equal(history.peekForward(), 4);
});

test("LinearHistory only moves when explicitly committed", () => {
  const history = new LinearHistory<number>(3);
  history.push(1);
  history.push(2);
  assert.equal(history.peekBack(), 1);
  assert.equal(history.peekBack(), 1);
  assert.equal(history.canGoForward, false);
});
