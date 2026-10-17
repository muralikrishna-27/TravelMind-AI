const workerThreads = require("node:worker_threads");
if (typeof workerThreads.markAsUncloneable !== "function") {
  workerThreads.markAsUncloneable = (val) => val;
}

if (typeof Promise.withResolvers === "undefined") {
  Promise.withResolvers = function () {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

class Node20Iterator {
  [Symbol.iterator]() {
    return this;
  }
  find(predicate) {
    for (const item of this) {
      if (predicate(item)) return item;
    }
    return undefined;
  }
  filter(predicate) {
    const self = this;
    return (function* () {
      for (const item of self) {
        if (predicate(item)) yield item;
      }
    })();
  }
  map(mapper) {
    const self = this;
    return (function* () {
      for (const item of self) {
        yield mapper(item);
      }
    })();
  }
  some(predicate) {
    for (const item of this) {
      if (predicate(item)) return true;
    }
    return false;
  }
  every(predicate) {
    for (const item of this) {
      if (!predicate(item)) return false;
    }
    return true;
  }
  toArray() {
    return Array.from(this);
  }
}

if (typeof globalThis.Iterator === "undefined") {
  globalThis.Iterator = Node20Iterator;
}

const vm = require("node:vm");
const origCreateContext = vm.createContext;
vm.createContext = function (sandbox, options) {
  if (sandbox) {
    if (typeof sandbox.Iterator === "undefined") {
      sandbox.Iterator = Node20Iterator;
    }
    if (sandbox.Promise && typeof sandbox.Promise.withResolvers === "undefined") {
      sandbox.Promise.withResolvers = Promise.withResolvers;
    }
  }
  const ctx = origCreateContext.call(this, sandbox, options);
  if (ctx) {
    if (typeof ctx.Iterator === "undefined") {
      try {
        ctx.Iterator = Node20Iterator;
      } catch (_) {}
    }
    if (ctx.Promise && typeof ctx.Promise.withResolvers === "undefined") {
      try {
        ctx.Promise.withResolvers = Promise.withResolvers;
      } catch (_) {}
    }
  }
  return ctx;
};
