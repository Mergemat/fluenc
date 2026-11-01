// The OAuth steps a coding agent sends the learner through on /connect. The provider signs the
// query it redirects with; this client sends it back with each step so the flow can continue.
import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { createAuthClient } from "better-auth/client";

import type { Credentials } from "./account";

let client: ReturnType<typeof makeClient> | null = null;
function makeClient() {
  return createAuthClient({ plugins: [oauthProviderClient()] });
}
const agentAuth = () => {
  client ??= makeClient();
  return client;
};

/** Better Auth answers each step with where to go next, and follows it itself. */
const follow = (data: unknown) => {
  if (
    data &&
    typeof data === "object" &&
    "url" in data &&
    typeof data.url === "string"
  ) {
    window.location.assign(data.url);
  }
};

export async function signedIn() {
  const { data } = await agentAuth().getSession();
  return Boolean(data?.session);
}

/** The name the agent registered under, such as "Claude Code". */
export async function agentName(clientId: string) {
  const { data } = await agentAuth().$fetch<{ client_name?: string }>(
    "/oauth2/public-client-prelogin",
    { method: "POST", body: { client_id: clientId } }
  );
  return data?.client_name ?? null;
}

/** Sign in, or create the account, then carry on to the consent step. Returns an error to show. */
export async function signInForAgent(
  mode: "sign-in" | "sign-up",
  { email, password }: Credentials
) {
  const auth = agentAuth();
  const { data, error } =
    mode === "sign-in"
      ? await auth.signIn.email({ email, password })
      : await auth.signUp.email({
          email,
          password,
          name: email.split("@")[0] ?? email,
        });
  if (error) {
    return error.message ?? "couldn’t sign in";
  }
  follow(data);
  return null;
}

/** Answer the agent's request; either way the browser goes back to the agent. */
export async function answerAgent(accept: boolean) {
  const { data, error } = await agentAuth().$fetch("/oauth2/consent", {
    method: "POST",
    body: { accept },
  });
  if (error) {
    return error.message ?? "couldn’t reach fluenc";
  }
  follow(data);
  return null;
}
