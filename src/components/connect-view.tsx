import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type FormEvent, useCallback, useState } from "react";

import {
  agentName,
  answerAgent,
  signedIn,
  signInForAgent,
} from "../account/agent-auth";
import { isShortcut, useWindowKeys } from "../hooks/use-window-keys";
import { cn } from "../lib/utils";
import { ActionButton } from "./ui/button";
import { ErrorNote, Page, PageHeader } from "./ui/layout";

type Mode = "sign-in" | "sign-up";

const note = "m-0 max-w-measure type-body text-muted-foreground";
const field = "grid gap-2";
const fieldLabel = "type-label text-muted-foreground";
const input =
  "h-12 rounded-lg border border-border bg-card px-3.5 type-heading text-foreground transition-colors focus:border-blue";
const secondary =
  "type-label text-muted-foreground hover:text-foreground underline underline-offset-3 transition-colors";
const offline = "couldn’t reach fluenc. check your connection";

const copy: Record<Mode, { submit: string; switch: string }> = {
  "sign-in": { submit: "sign in", switch: "new here? create an account" },
  "sign-up": { submit: "create account", switch: "have an account? sign in" },
};

/**
 * Where a coding agent sends the learner to let it manage their focus: sign in if needed, then
 * allow or deny. Every answer sends the browser back to the agent.
 */
export function ConnectView({ clientId }: { clientId: string | null }) {
  const visit = useQuery({
    queryKey: ["connect", clientId],
    queryFn: async () => {
      const [session, name] = await Promise.all([
        signedIn(),
        agentName(clientId ?? "").catch(() => null),
      ]);
      return { session, name };
    },
    enabled: Boolean(clientId),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });

  if (!clientId) {
    return (
      <Page head={<PageHeader title="connect" />}>
        <p className={note}>
          nothing to connect here. add fluenc to your coding agent from{" "}
          <Link to="/settings">settings</Link>, and it brings you back.
        </p>
      </Page>
    );
  }

  const agent = visit.data?.name ?? "your agent";
  return (
    <Page head={<PageHeader title="connect" />}>
      {visit.isError ? <ErrorNote>{offline}</ErrorNote> : null}
      {visit.data?.session === false ? <SignIn agent={agent} /> : null}
      {visit.data?.session ? <Consent agent={agent} /> : null}
    </Page>
  );
}

function SignIn({ agent }: { agent: string }) {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      setBusy(true);
      setError(null);
      try {
        const problem = await signInForAgent(mode, {
          email: String(form.get("email") ?? "").trim(),
          password: String(form.get("password") ?? ""),
        }).catch(() => offline);
        if (problem) {
          setError(problem.toLowerCase());
        }
      } finally {
        setBusy(false);
      }
    },
    [mode]
  );
  const toggle = useCallback(() => {
    setError(null);
    setMode((current) => (current === "sign-in" ? "sign-up" : "sign-in"));
  }, []);

  return (
    <form className="max-w-form grid gap-4" onSubmit={submit}>
      <p className={cn(note, "mb-2")}>
        sign in so {agent} can choose what you learn next.
      </p>
      <label className={field}>
        <span className={fieldLabel}>email</span>
        <input
          autoCapitalize="none"
          autoComplete="email"
          className={input}
          inputMode="email"
          name="email"
          required
          spellCheck={false}
          type="email"
        />
      </label>
      <label className={field}>
        <span className={fieldLabel}>password</span>
        <input
          autoComplete={
            mode === "sign-in" ? "current-password" : "new-password"
          }
          className={input}
          minLength={8}
          name="password"
          required
          type="password"
        />
      </label>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="mt-2 grid justify-items-center gap-4">
        <ActionButton
          color="blue"
          disabled={busy}
          hint="↵"
          type="submit"
          variant="gradient"
        >
          {busy ? "one moment…" : copy[mode].submit}
        </ActionButton>
        <button className={secondary} onClick={toggle} type="button">
          {copy[mode].switch}
        </button>
      </div>
    </form>
  );
}

function Consent({ agent }: { agent: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const answer = useCallback(async (accept: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const problem = await answerAgent(accept).catch(() => offline);
      if (problem) {
        setError(problem.toLowerCase());
      }
    } finally {
      setBusy(false);
    }
  }, []);
  const allow = useCallback(() => answer(true), [answer]);
  const deny = useCallback(() => answer(false), [answer]);

  useWindowKeys((event) => {
    if (event.key === "Enter" && !event.repeat && isShortcut(event)) {
      event.preventDefault();
      allow();
    }
  }, !busy);

  return (
    <div className="max-w-form grid gap-4">
      <h2 className="type-heading m-0">
        let {agent} choose what you learn next?
      </h2>
      <p className={note}>
        it can read your focus list, add words and sentences to it, and remove
        them. it can’t see or change anything else.
      </p>
      {/* An agent names itself when it registers; only the learner knows they just started this. */}
      <p className={note}>
        allow it only if you just added fluenc to {agent} yourself.
      </p>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="mt-2 grid justify-items-center gap-4">
        <ActionButton
          color="blue"
          disabled={busy}
          hint="↵"
          onClick={allow}
          variant="gradient"
        >
          {busy ? "one moment…" : "allow"}
        </ActionButton>
        <button
          className={secondary}
          disabled={busy}
          onClick={deny}
          type="button"
        >
          deny
        </button>
      </div>
    </div>
  );
}
