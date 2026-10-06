import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { hasPendingProgress } from "../offline/progress";
import type {
  DownloadStatus,
  OfflineDownload,
} from "../offline/use-offline-download";
import {
  type UpdateStatus,
  useAppUpdate,
} from "../updates/app-update-provider";
import { DitherButton } from "./dither-kit/button";
import { DitherGradient } from "./dither-kit/gradient";
import { NotificationSettings } from "./notification-settings";
import { Rule } from "./ui/dither";
import { Page, PageHeader } from "./ui/layout";
import { SettingRow, type Tone } from "./ui/setting-row";

type RowState = [Tone, string];

const offlineStates: Record<
  Exclude<DownloadStatus, "downloading" | "checking">,
  RowState
> = {
  ready: ["ok", "saved on this device"],
  idle: ["warn", "downloads when you’re back online"],
  error: ["error", "interrupted · retries when online"],
  development: ["idle", "published app only"],
  unsupported: ["idle", "not supported in this browser"],
};
const updateStates: Record<UpdateStatus, RowState> = {
  applying: ["busy", "updating…"],
  error: ["error", "could not check · retries on open"],
  development: ["idle", "published app only"],
  unsupported: ["idle", "published app only"],
  checking: ["busy", "checking…"],
  current: ["ok", "up to date"],
};

function offlineState(
  status: DownloadStatus,
  percentage: number | null
): RowState {
  if (status === "downloading" || status === "checking") {
    return [
      "busy",
      percentage === null ? "downloading…" : `downloading · ${percentage}%`,
    ];
  }
  return offlineStates[status];
}

function syncState(pending: boolean | undefined, checking: boolean): RowState {
  if (pending) {
    return ["busy", "changes waiting to sync"];
  }
  return checking ? ["busy", "checking…"] : ["ok", "all progress synced"];
}

/**
 * Reminders are the only real choice. Everything else — offline download, progress sync,
 * app updates — runs by itself, so this page only reports how the device is doing.
 */
export function SettingsView({ offline }: { offline: OfflineDownload }) {
  const update = useAppUpdate();
  const pending = useQuery({
    queryKey: ["pending-progress"],
    queryFn: hasPendingProgress,
    refetchInterval: 3000,
    networkMode: "always",
  });
  const percentage = offline.progress?.total
    ? Math.floor((offline.progress.completed / offline.progress.total) * 100)
    : null;

  const [offlineTone, offlineText] = offlineState(offline.status, percentage);
  const [syncTone, syncText] = syncState(pending.data, pending.isPending);
  const [updateTone, updateText] = update.available
    ? (["warn", "new version ready"] satisfies RowState)
    : updateStates[update.status];

  return (
    <Page>
      <PageHeader title="settings" />
      <div className="dx-set">
        <h2 className="dx-label dx-set-group">
          <span>reminders</span>
          <Rule />
        </h2>
        <NotificationSettings />
        <h2 className="dx-label dx-set-group">
          <span>this device</span>
          <Rule />
        </h2>
        <SettingRow
          id="offline-heading"
          note="lessons, strokes and character audio"
          status={offlineText}
          title="offline"
          tone={offlineTone}
        >
          {offline.status === "downloading" && percentage !== null ? (
            <span aria-hidden="true" className="dx-progress dx-set-meter">
              <DitherGradient
                cell={2}
                direction="right"
                from="grey"
                opacity={0.5}
              />
              <span
                className="dx-progress-fill"
                style={{ width: `${percentage}%` }}
              >
                <DitherGradient cell={2} direction="left" from="blue" />
              </span>
            </span>
          ) : null}
        </SettingRow>
        <SettingRow
          id="sync-heading"
          note="saved here first, synced in the background"
          status={syncText}
          title="progress"
          tone={syncTone}
        />
        <SettingRow
          id="update-heading"
          note="checked each time you open fluenc"
          status={updateText}
          title="version"
          tone={updateTone}
        >
          {update.available ? (
            <DitherButton
              className="dx-tool"
              color="blue"
              disabled={update.status === "applying"}
              onClick={update.apply}
              variant="gradient"
            >
              <RefreshCw size={13} />
              refresh
            </DitherButton>
          ) : null}
        </SettingRow>
      </div>
    </Page>
  );
}
