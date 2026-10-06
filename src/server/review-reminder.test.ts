import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { type Client, createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import webpush from "web-push";

import { schema } from "../db/schema";
import {
  type DeviceSubscription,
  pushSubscriptionInput,
} from "./push.contract";
import { createPushStore, type PushStore } from "./push-store.server";
import { handleReviewReminder } from "./review-reminder.server";

let client: Client;
let store: PushStore;
const device = (name: string): DeviceSubscription => ({
  endpoint: `https://web.push.apple.com/${name}`,
  keys: { p256dh: "B".repeat(87), auth: "a".repeat(22) },
});

beforeEach(async () => {
  client = createClient({ url: ":memory:" });
  await client.execute(
    await Bun.file("drizzle/0002_ambitious_squadron_sinister.sql").text()
  );
  store = createPushStore(drizzle(client, { schema }));
});
afterEach(() => client.close());

function setup() {
  return {
    cronSecret: "test-cron-secret",
    configured: true,
    store,
    now: new Date("2026-09-11T06:00:00.000Z"),
    send: mock(
      (_subscription: DeviceSubscription): Promise<void> => Promise.resolve()
    ),
  };
}
const request = (token = "test-cron-secret") =>
  new Request("https://fluenc.example/api/review-reminder", {
    headers: { authorization: `Bearer ${token}` },
  });

test("unauthorized and unconfigured jobs cannot consume daily delivery", async () => {
  await store.save(device("phone"));
  const options = setup();
  expect((await handleReviewReminder(request("wrong"), options)).status).toBe(
    401
  );
  expect(
    (await handleReviewReminder(request(), { ...options, configured: false }))
      .status
  ).toBe(503);
  expect(options.send).not.toHaveBeenCalled();
  expect((await handleReviewReminder(request(), options)).status).toBe(200);
  expect(options.send).toHaveBeenCalledTimes(1);
});

test("daily reminders reach subscribed devices without any learning progress", async () => {
  // This database has subscriptions only, with no learner or review tables.
  await store.save(device("phone"));
  const options = setup();
  expect(await (await handleReviewReminder(request(), options)).json()).toEqual(
    { status: "accepted", devices: 1, failed: 0 }
  );
  expect(options.send).toHaveBeenCalledTimes(1);
  expect(options.send).toHaveBeenCalledWith(device("phone"));
});

test("concurrent cron runs and subscription refreshes send once per device per Shanghai day", async () => {
  await store.save(device("phone"));
  await store.save(device("tablet"));
  const options = setup();
  await Promise.all([
    handleReviewReminder(request(), options),
    handleReviewReminder(request(), options),
  ]);
  expect(options.send).toHaveBeenCalledTimes(2);
  await store.save(device("phone"));
  await handleReviewReminder(request(), options);
  expect(options.send).toHaveBeenCalledTimes(2);
  await handleReviewReminder(request(), {
    ...options,
    now: new Date("2026-09-12T06:00:00.000Z"),
  });
  expect(options.send).toHaveBeenCalledTimes(4);
});

test("expired devices are removed, transient failures retry, accepted devices are not resent", async () => {
  await Promise.all(
    ["phone", "expired", "offline"].map((name) => store.save(device(name)))
  );
  const options = setup();
  options.send.mockImplementation((subscription) => {
    if (subscription.endpoint.endsWith("/expired")) {
      return Promise.reject(
        new webpush.WebPushError("Gone", 410, {}, "", subscription.endpoint)
      );
    }
    if (subscription.endpoint.endsWith("/offline")) {
      return Promise.reject(new Error("secret subscription details"));
    }
    return Promise.resolve();
  });
  const response = await handleReviewReminder(request(), options);
  expect(response.status).toBe(502);
  expect(await response.json()).toMatchObject({ devices: 1, failed: 1 });
  expect(await store.has(device("expired"))).toBe(false);
  options.send.mockClear();
  options.send.mockResolvedValue(undefined);
  await handleReviewReminder(request(), options);
  expect(
    options.send.mock.calls.map(([subscription]) => subscription.endpoint)
  ).toEqual([device("offline").endpoint]);
});

test("unsubscribe affects only the matching device credentials", async () => {
  await store.save(device("phone"));
  await store.save(device("tablet"));
  await store.remove({
    ...device("phone"),
    keys: { ...device("phone").keys, auth: "wrong" },
  });
  expect(await store.has(device("phone"))).toBe(true);
  await store.remove(device("phone"));
  const options = setup();
  await handleReviewReminder(request(), options);
  expect(
    options.send.mock.calls.map(([subscription]) => subscription.endpoint)
  ).toEqual([device("tablet").endpoint]);
});

test("subscription validation rejects arbitrary hosts, credentials, ports and malformed keys", () => {
  for (const endpoint of [
    "not a URL",
    "http://web.push.apple.com/x",
    "https://127.0.0.1/x",
    "https://web.push.apple.com.evil.example/x",
    "https://user:password@web.push.apple.com/x",
    "https://web.push.apple.com:444/x",
  ]) {
    expect(
      pushSubscriptionInput.safeParse({ ...device("phone"), endpoint }).success
    ).toBe(false);
  }
  expect(
    pushSubscriptionInput.safeParse({
      ...device("phone"),
      keys: { p256dh: "bad", auth: "bad" },
    }).success
  ).toBe(false);
  expect(pushSubscriptionInput.safeParse(device("phone")).success).toBe(true);
});
