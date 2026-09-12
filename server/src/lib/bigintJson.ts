// All our primary keys are BIGINT UNSIGNED, so Prisma returns them as
// JS `bigint`, which JSON.stringify cannot serialize natively (it throws
// "Do not know how to serialize a BigInt"). Stringifying it is the standard,
// precision-safe fix for BigInt IDs in a JSON API. Must be imported before
// any request is handled - imported first thing in server.ts.
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

BigInt.prototype.toJSON = function (this: bigint) {
  return this.toString();
};

export {};
