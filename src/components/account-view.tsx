import { Link, useNavigate } from "@tanstack/react-router";
import { LogIn, UserPlus } from "lucide-react";
import { type FormEvent, useCallback, useState } from "react";

import { signIn } from "../account/account";
import { useSyncStatus } from "../offline/sync";
import { DitherButton } from "./dither-kit/button";
import { tool } from "./ui/buttons";
import { ErrorNote, Page, PageHeader } from "./ui/layout";
import { useToast } from "./ui/toast";

type Mode = "sign-in" | "sign-up";

const note = "m-0 max-w-measure type-body text-muted-foreground";
const field = "grid gap-tight";
const fieldLabel = "type-label text-muted-foreground";
const input =
  "h-12 rounded-xl border border-border bg-card px-3.5 type-heading text-foreground transition-colors focus:border-blue";

const copy: Record<Mode, { title: string; submit: string; switch: string }> = {
  "sign-in": {
    title: "sign in",
    submit: "sign in",
    switch: "new here? create an account",
  },
  "sign-up": {
    title: "create account",
    submit: "create account",
    switch: "have an account? sign in",
  },
};

/**
 * An account only adds sync: fluenc works the same without one. Signing in sends what this
 * device already learned to the account, so nothing is lost by starting without one.
 */
export function AccountView() {
  const status = useSyncStatus();
  const navigate = useNavigate();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toggle = useCallback(() => {
    setError(null);
    setMode((current) => (current === "sign-in" ? "sign-up" : "sign-in"));
  }, []);

  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      setBusy(true);
      setError(null);
      try {
        const failure = await signIn(mode, {
          email: String(form.get("email") ?? "").trim(),
          password: String(form.get("password") ?? ""),
        });
        if (failure) {
          setError(failure.toLowerCase());
          return;
        }
        toast("signed in · progress syncs across your devices");
        await navigate({ to: "/settings" });
      } catch {
        setError("couldn’t reach fluenc. check your connection");
      } finally {
        setBusy(false);
      }
    },
    [mode, navigate, toast]
  );

  if (status.learner && status.signedIn) {
    return (
      <Page head={<PageHeader title="account" />}>
        <p className={note}>
          signed in as{" "}
          <b className="font-medium text-foreground">{status.learner.email}</b>.{" "}
          <Link to="/settings">back to settings</Link>
        </p>
      </Page>
    );
  }

  const text = copy[mode];
  const Icon = mode === "sign-in" ? LogIn : UserPlus;
  return (
    <Page head={<PageHeader title={text.title} />}>
      <form className="grid max-w-form gap-item" onSubmit={submit}>
        <p className={note}>
          sync progress between your devices. what you learned here joins the
          account.
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
        <div className="mt-tight flex flex-wrap items-center gap-x-item gap-y-tight">
          <DitherButton
            className={tool}
            color="blue"
            disabled={busy}
            type="submit"
            variant="gradient"
          >
            <Icon className="shrink-0" size={13} />
            {busy ? "one moment…" : text.submit}
          </DitherButton>
          <button
            className="type-label text-muted-foreground underline underline-offset-3 transition-colors hover:text-foreground"
            onClick={toggle}
            type="button"
          >
            {text.switch}
          </button>
        </div>
      </form>
    </Page>
  );
}
