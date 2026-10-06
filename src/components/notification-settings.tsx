import { Bell, BellOff, RefreshCw } from "lucide-react";

import {
  type NotificationAction,
  type NotificationStatus,
  useNotifications,
} from "../notifications/use-notifications";
import { DitherButton } from "./dither-kit/button";
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
      title="Review reminders"
      tone={tone}
    >
      {status === "off" ? (
        <DitherButton
          className="dx-tool"
          color="blue"
          disabled={!!busy}
          onClick={enable}
          variant="gradient"
        >
          <Bell size={13} />
          enable
        </DitherButton>
      ) : null}
      {hasSubscription ? (
        <DitherButton
          className="dx-tool"
          color="red"
          disabled={!!busy || status === "checking"}
          onClick={disable}
          variant="dotted"
        >
          <BellOff size={13} />
          turn off
        </DitherButton>
      ) : null}
      {status === "error" ||
      status === "blocked" ||
      status === "unconfigured" ? (
        <DitherButton
          className="dx-tool"
          color="grey"
          disabled={!!busy}
          onClick={retry}
          variant="dotted"
        >
          <RefreshCw size={13} />
          check again
        </DitherButton>
      ) : null}
    </SettingRow>
  );
}
