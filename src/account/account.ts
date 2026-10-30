// Signing in links this device's progress to an account; signing out takes it off the device.
import { countPending } from "../progress/store";
import { forgetDevice, syncNow } from "../progress/sync";

// Better Auth's client loads only when the learner signs in or out; nothing else needs it.
let client: Promise<
  ReturnType<typeof import("better-auth/client").createAuthClient>
> | null = null;
const authClient = () => {
  client ??= import("better-auth/client").then(({ createAuthClient }) =>
    createAuthClient()
  );
  return client;
};

export interface Credentials {
  email: string;
  password: string;
}

/** Sign in, or create the account, then send this device's progress to it. Returns an error to show. */
export async function signIn(
  mode: "sign-in" | "sign-up",
  { email, password }: Credentials
): Promise<string | null> {
  const auth = await authClient();
  const { error } =
    mode === "sign-in"
      ? await auth.signIn.email({ email, password })
      : await auth.signUp.email({
          email,
          password,
          // Better Auth needs a name; fluenc never shows one.
          name: email.split("@")[0] ?? email,
        });
  if (error) {
    return error.message ?? "couldn’t sign in";
  }
  await syncNow();
  return null;
}

/** How many changes would be lost by signing out now, after one last try to send them. */
export async function unsyncedChanges() {
  await syncNow();
  return countPending();
}

/** Sign out and forget this device's progress. Needs the network, or the session would stay. */
export async function signOut() {
  const auth = await authClient();
  const { error } = await auth.signOut();
  if (error) {
    throw new Error(error.message ?? "couldn’t sign out");
  }
  await forgetDevice();
}
