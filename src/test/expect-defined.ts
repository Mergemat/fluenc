import { expect } from "bun:test";

/** Assert that a value exists, and narrow its type for the rest of the test. */
export function expectDefined<T>(value: T | null | undefined): T {
  expect(value).toBeDefined();
  expect(value).not.toBeNull();
  if (value === null || value === undefined) {
    throw new Error("Expected a value");
  }
  return value;
}
