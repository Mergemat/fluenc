import { Link } from "@tanstack/react-router";
import { Play } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/utils";
import type {
  DownloadStatus,
  OfflineDownload,
} from "../offline/use-offline-download";
import { AccountSettings } from "./account-settings";
import { DitherGradient } from "./dither-kit/gradient";
import { NotificationSettings } from "./notification-settings";
import { chip, Page, PageHeader, SectionHead } from "./ui/layout";
import { SettingRow, type Tone } from "./ui/setting-row";
import { progressFill, progressTrack } from "./ui/split-meter";

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

/** A named group of rows. */
function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <SectionHead className="mb-0" label={label} />
      {children}
    </div>
  );
}

/**
 * The account and reminders are the real choices. Everything else — offline download and sync —
 * runs by itself, so this page only reports how the device is doing.
 */
export function SettingsView({ offline }: { offline: OfflineDownload }) {
  const percentage = offline.progress?.total
    ? Math.floor((offline.progress.completed / offline.progress.total) * 100)
    : null;

  const [offlineTone, offlineText] = offlineState(offline.status, percentage);

  return (
    <Page head={<PageHeader title="settings" />}>
      {/* The rows pad themselves by 12, which makes up the rest of the section gap. */}
      <div className="grid gap-9">
        <Group label="account">
          <AccountSettings />
        </Group>
        <Group label="reminders">
          <NotificationSettings />
        </Group>
        <Group label="the method">
          <SettingRow
            id="welcome-heading"
            note="how a character becomes a short movie"
            status="about a minute"
            title="welcome reel"
            tone="idle"
          >
            <Link className={chip} to="/welcome">
              <Play size={13} />
              watch again
            </Link>
          </SettingRow>
        </Group>
        <Group label="this device">
          <SettingRow
            id="offline-heading"
            note="lessons, strokes and character audio"
            status={offlineText}
            title="offline"
            tone={offlineTone}
          >
            {offline.status === "downloading" && percentage !== null ? (
              <span
                aria-hidden="true"
                className={cn(progressTrack, "w-32 max-w-none flex-none")}
              >
                <DitherGradient
                  cell={2}
                  direction="right"
                  from="grey"
                  opacity={0.5}
                />
                <span
                  className={progressFill}
                  style={{ width: `${percentage}%` }}
                >
                  <DitherGradient cell={2} direction="left" from="blue" />
                </span>
              </span>
            ) : null}
          </SettingRow>
        </Group>
      </div>
    </Page>
  );
}
