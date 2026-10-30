import { useNavigate } from "@tanstack/react-router";
import { LogIn, LogOut, RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { signOut, unsyncedChanges } from "../account/account";
import { useNow } from "../hooks/use-now";
import { type SyncStatus, syncNow, useSyncStatus } from "../progress/sync";
import { ToolButton } from "./ui/button";
import { SettingRow, type Tone } from "./ui/setting-row";

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
type SignOut =
  | { step: "idle" }
  | { step: "checking" }
  | { step: "confirm"; unsynced: number }
  | { step: "error"; message: string };

export function AccountSettings() {
  const status = useSyncStatus();
  const navigate = useNavigate();
  // "synced 3 minutes ago" stays within half a minute of true.
  const now = useNow(MINUTE / 2);
  const [leaving, setLeaving] = useState<SignOut>({ step: "idle" });

  const openAccount = useCallback(() => {
    navigate({ to: "/account" }).catch(() => undefined);
  }, [navigate]);
  const sync = useCallback(() => {
    syncNow().catch(() => undefined);
  }, []);
  const leave = useCallback(async (force: boolean) => {
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
  }, []);
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
        <ToolButton icon={LogIn} onClick={openAccount} tone="primary">
          sign in
        </ToolButton>
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
        <ToolButton icon={LogIn} onClick={openAccount} tone="primary">
          sign in
        </ToolButton>
      ) : null}
      {leaving.step === "confirm" ? (
        <>
          <ToolButton onClick={keep} tone="quiet">
            keep
          </ToolButton>
          <ToolButton icon={LogOut} onClick={forceSignOut} tone="danger">
            sign out anyway
          </ToolButton>
        </>
      ) : (
        <>
          {status.signedIn ? (
            <ToolButton
              aria-label="Sync now"
              disabled={status.phase === "syncing"}
              icon={RefreshCw}
              onClick={sync}
              tone="quiet"
            />
          ) : null}
          <ToolButton
            disabled={leaving.step === "checking"}
            icon={LogOut}
            onClick={startSignOut}
            tone="danger"
          >
            sign out
          </ToolButton>
        </>
      )}
    </SettingRow>
  );
}
