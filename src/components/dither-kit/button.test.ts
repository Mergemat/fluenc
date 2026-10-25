import { expect, test } from "bun:test";

import { glowToward } from "./button";

const glowAfter = (ms: number, hz: number) => {
  let intensity = 0;
  for (let frame = 0; frame < (ms * hz) / 1000; frame += 1) {
    intensity = glowToward(intensity, 1, 1000 / hz);
  }
  return intensity;
};

test("the glow rises at the same pace on 60Hz and 120Hz screens", () => {
  const at60 = glowAfter(100, 60);
  expect(glowAfter(100, 120)).toBeCloseTo(at60, 5);
  expect(at60).toBeGreaterThan(0.1);
  expect(at60).toBeLessThan(0.9);
});
