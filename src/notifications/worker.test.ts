import { expect, mock, test } from "bun:test";
import { openReview, showPushNotification } from "./worker";

const origin = "https://fluenc.example";
function windowClient(url: string) {
  const client = {
    url,
    focus: mock(async () => client),
    navigate: mock(async (_url: string): Promise<unknown> => client),
  };
  return client;
}
function clientsFor(windows: ReturnType<typeof windowClient>[]) {
  return {
    matchAll: mock(async () => windows),
    openWindow: mock(async (_url: string) => null),
  };
}

test("a cold notification tap opens the in-scope Review URL", async () => {
  const clients = clientsFor([]);
  await openReview(clients as unknown as Clients, origin);
  expect(clients.openWindow).toHaveBeenCalledWith(
    "https://fluenc.example/review"
  );
});

test("a resumed app is focused before navigation, without opening a browser window", async () => {
  const client = windowClient(`${origin}/lessons`);
  client.navigate.mockImplementation(() => {
    expect(client.focus).toHaveBeenCalledTimes(1);
    return Promise.resolve(client);
  });
  const clients = clientsFor([client]);
  await openReview(clients as unknown as Clients, origin);
  expect(client.navigate).toHaveBeenCalledWith(`${origin}/review`);
  expect(clients.openWindow).not.toHaveBeenCalled();
});

test("a closing app does not swallow a tap", async () => {
  const client = windowClient(`${origin}/settings`);
  client.focus.mockRejectedValue(new Error("Window closed"));
  const clients = clientsFor([client]);
  await openReview(clients as unknown as Clients, origin);
  expect(clients.openWindow).toHaveBeenCalledWith(`${origin}/review`);
});

test("an existing Review session is focused without a destructive reload", async () => {
  const client = windowClient(`${origin}/review`);
  const clients = clientsFor([client]);
  await openReview(clients as unknown as Clients, origin);
  expect(client.focus).toHaveBeenCalledTimes(1);
  expect(client.navigate).not.toHaveBeenCalled();
  expect(clients.openWindow).not.toHaveBeenCalled();
});

test("empty or malformed pushes still show a visible notification", async () => {
  const registration = {
    showNotification: mock((_title: string, _options: NotificationOptions) =>
      Promise.resolve()
    ),
  };
  const pushes = [
    null,
    {
      json: () => {
        throw new Error("bad JSON");
      },
    },
    { json: () => null },
  ];
  await Promise.all(
    pushes.map((data) =>
      showPushNotification(
        data as PushMessageData | null,
        registration as unknown as ServiceWorkerRegistration
      )
    )
  );
  expect(registration.showNotification).toHaveBeenCalledTimes(3);
  for (const [title, options] of registration.showNotification.mock.calls) {
    expect(title).toBe("Fluenc");
    expect(options.body).toBeTruthy();
  }
});
