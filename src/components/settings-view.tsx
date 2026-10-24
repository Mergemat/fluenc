import { Link } from "@tanstack/react-router";
import { Play, RefreshCw } from "lucide-react";

import type {
  DownloadStatus,
  OfflineDownload,
} from "../offline/use-offline-download";
import {
  type UpdateStatus,
  useAppUpdate,
} from "../updates/app-update-provider";
import { AccountSettings } from "./account-settings";
import { DitherButton } from "./dither-kit/button";
import { DitherGradient } from "./dither-kit/gradient";
import { NotificationSettings } from "./notification-settings";
import { Page, PageHeader, SectionHead } from "./ui/layout";
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
  // Installed alongside this version; it takes over the next time fluenc is out of sight.
  ready: ["warn", "new version ready · applies when you leave fluenc"],
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

/**
 * The account and reminders are the real choices. Everything else — offline download, sync,
 * app updates — runs by itself, so this page only reports how the device is doing.
 */
export function SettingsView({ offline }: { offline: OfflineDownload }) {
  const update = useAppUpdate();
  const percentage = offline.progress?.total
    ? Math.floor((offline.progress.completed / offline.progress.total) * 100)
    : null;

  const [offlineTone, offlineText] = offlineState(offline.status, percentage);
  const [updateTone, updateText] = updateStates[update.status];

  return (
    <Page head={<PageHeader title="settings" />}>
      <div className="dx-set">
        <SectionHead className="dx-set-group" label="account" />
        <AccountSettings />
        <SectionHead className="dx-set-group" label="reminders" />
        <NotificationSettings />
        <SectionHead className="dx-set-group" label="the method" />
        <SettingRow
          id="welcome-heading"
          note="how a character becomes a short movie"
          status="about a minute"
          title="welcome reel"
          tone="idle"
        >
          <Link className="dx-chip" to="/welcome">
            <Play size={13} />
            watch again
          </Link>
        </SettingRow>
        <SectionHead className="dx-set-group" label="this device" />
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
          id="update-heading"
          note="updates install in the background"
          status={updateText}
          title="version"
          tone={updateTone}
        >
          {update.status === "ready" || update.status === "applying" ? (
            <DitherButton
              className="dx-tool"
              color="blue"
              disabled={update.status === "applying"}
              onClick={update.apply}
              variant="gradient"
            >
              <RefreshCw size={13} />
              update now
            </DitherButton>
          ) : null}
        </SettingRow>
      </div>
    </Page>
  );
}
