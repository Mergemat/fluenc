import { createFileRoute } from "@tanstack/react-router";

import { SettingsView } from "../components/settings-view";
import { useAppOfflineDownload } from "../offline/offline-download-provider";

export const Route = createFileRoute("/_app/settings")({ component: Settings });

function Settings() {
  const offline = useAppOfflineDownload();
  return <SettingsView offline={offline} />;
}
