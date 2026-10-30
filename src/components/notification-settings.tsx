import { Bell, BellOff, RefreshCw } from "lucide-react";

import {
  type NotificationAction,
  type NotificationStatus,
  useNotifications,
} from "../notifications/use-notifications";
import { ToolButton } from "./ui/button";
import { SettingRow, type Tone } from "./ui/setting-row";

const statusTone: Record<NotificationStatus, Tone> = {
  checking: "busy",
  on: "ok",
  install: "warn",
  blocked: "error",
  error: "error",
  unsupported: "idle",
  development: "idle",
  unconfigured: "idle",
  off: "idle",
};
const statusText: Record<NotificationStatus, string> = {
  checking: "checking…",
  install: "open fluenc from your home screen (share → add to home screen)",
  unsupported: "needs iOS 16.4+ or a supported browser",
  development: "available in the published app",
  unconfigured: "not configured yet",
  blocked: "blocked — allow fluenc in system notification settings",
  on: "on for this device",
  off: "off",
  error: "could not check",
};
const busyText: Record<NotificationAction, string> = {
  subscribe: "preparing — keep fluenc open",
  unsubscribe: "turning off…",
  test: "sending test…",
};

export function NotificationSettings() {
  const { status, busy, message, hasSubscription, enable, disable, retry } =
    useNotifications();
  const tone: Tone = busy ? "busy" : statusTone[status];
  const text = busy ? busyText[busy] : message || statusText[status];

  return (
    <SettingRow
      id="notifications-heading"
      note="daily · 14:00 shanghai, may arrive within the hour"
      status={text}
      title="review reminders"
      tone={tone}
    >
      {status === "off" ? (
        <ToolButton
          disabled={!!busy}
          icon={Bell}
          onClick={enable}
          tone="primary"
        >
          enable
        </ToolButton>
      ) : null}
      {hasSubscription ? (
        <ToolButton
          disabled={!!busy || status === "checking"}
          icon={BellOff}
          onClick={disable}
          tone="danger"
        >
          turn off
        </ToolButton>
      ) : null}
      {status === "error" ||
      status === "blocked" ||
      status === "unconfigured" ? (
        <ToolButton
          disabled={!!busy}
          icon={RefreshCw}
          onClick={retry}
          tone="quiet"
        >
          check again
        </ToolButton>
      ) : null}
    </SettingRow>
  );
}
