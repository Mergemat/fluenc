import { useNavigate } from "@tanstack/react-router";
import { LogIn, LogOut, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { signOut, unsyncedChanges } from "../account/account";
import { type SyncStatus, syncNow, useSyncStatus } from "../offline/sync";
import { DitherButton } from "./dither-kit/button";
import { SettingRow, type Tone } from "./ui/setting-row";
import { useToast } from "./ui/toast";

const MINUTE = 60_000;

function ago(time: number, now: number) {
  const minutes = Math.floor((now - time) / MINUTE);
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.floor(minutes / 60);
  return hours < 24
    ? `${hours} h ago`
    : new Date(time).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
}

const changes = (count: number) =>
  count === 1 ? "1 change" : `${count} changes`;

function syncLine(status: SyncStatus, now: number): [Tone, string] {
  if (status.signedIn === false) {
    return ["warn", "signed out · progress here waits until you sign in"];
  }
  if (status.phase === "syncing") {
    return ["busy", "syncing…"];
  }
  if (status.phase === "error") {
    return ["error", "couldn’t sync · trying again shortly"];
  }
  if (status.phase === "offline") {
    return status.pending
      ? ["warn", `offline · ${changes(status.pending)} wait to sync`]
      : ["idle", "offline · everything here is saved"];
  }
  if (status.pending) {
    return ["busy", `sending ${changes(status.pending)}…`];
  }
  return status.syncedAt
    ? ["ok", `synced ${ago(status.syncedAt, now)}`]
    : ["busy", "checking…"];
}

/** Re-render every minute, for "synced 3 min ago". */
function useMinute() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), MINUTE / 2);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

type SignOut =
  | { step: "idle" }
  | { step: "checking" }
  | { step: "confirm"; unsynced: number }
  | { step: "error"; message: string };

export function AccountSettings() {
  const status = useSyncStatus();
  const navigate = useNavigate();
  const toast = useToast();
  const now = useMinute();
  const [leaving, setLeaving] = useState<SignOut>({ step: "idle" });

  const openAccount = useCallback(() => {
    navigate({ to: "/account" }).catch(() => undefined);
  }, [navigate]);
  const sync = useCallback(() => {
    syncNow().catch(() => undefined);
  }, []);
  const leave = useCallback(
    async (force: boolean) => {
      setLeaving({ step: "checking" });
      try {
        const unsynced = force ? 0 : await unsyncedChanges();
        if (unsynced) {
          setLeaving({ step: "confirm", unsynced });
          return;
        }
        await signOut();
        setLeaving({ step: "idle" });
        toast("signed out · this device starts fresh");
      } catch {
        setLeaving({
          step: "error",
          message: "couldn’t sign out · connect and try again",
        });
      }
    },
    [toast]
  );
  const startSignOut = useCallback(() => {
    leave(false).catch(() => undefined);
  }, [leave]);
  const forceSignOut = useCallback(() => {
    leave(true).catch(() => undefined);
  }, [leave]);
  const keep = useCallback(() => setLeaving({ step: "idle" }), []);

  if (!status.learner) {
    return (
      <SettingRow
        id="account-heading"
        note="sign in to keep progress on all your devices"
        status="progress is saved on this device only"
        title="sync"
        tone="idle"
      >
        <DitherButton
          className="dx-tool"
          color="blue"
          onClick={openAccount}
          variant="gradient"
        >
          <LogIn size={13} />
          sign in
        </DitherButton>
      </SettingRow>
    );
  }

  let [tone, text] = syncLine(status, now);
  if (leaving.step === "confirm") {
    [tone, text] = [
      "error",
      `${changes(leaving.unsynced)} haven’t synced and would be lost`,
    ];
  } else if (leaving.step === "error") {
    [tone, text] = ["error", leaving.message];
  } else if (leaving.step === "checking") {
    [tone, text] = ["busy", "signing out…"];
  }

  return (
    <SettingRow
      id="account-heading"
      note={status.learner.email}
      status={text}
      title="sync"
      tone={tone}
    >
      {status.signedIn === false ? (
        <DitherButton
          className="dx-tool"
          color="blue"
          onClick={openAccount}
          variant="gradient"
        >
          <LogIn size={13} />
          sign in
        </DitherButton>
      ) : null}
      {leaving.step === "confirm" ? (
        <>
          <DitherButton
            className="dx-tool"
            color="grey"
            onClick={keep}
            variant="dotted"
          >
            keep
          </DitherButton>
          <DitherButton
            className="dx-tool"
            color="red"
            onClick={forceSignOut}
            variant="dotted"
          >
            <LogOut size={13} />
            sign out anyway
          </DitherButton>
        </>
      ) : (
        <>
          {status.signedIn ? (
            <DitherButton
              aria-label="Sync now"
              className="dx-tool"
              color="grey"
              disabled={status.phase === "syncing"}
              onClick={sync}
              variant="dotted"
            >
              <RefreshCw size={13} />
            </DitherButton>
          ) : null}
          <DitherButton
            className="dx-tool"
            color="red"
            disabled={leaving.step === "checking"}
            onClick={startSignOut}
            variant="dotted"
          >
            <LogOut size={13} />
            sign out
          </DitherButton>
        </>
      )}
    </SettingRow>
  );
}
