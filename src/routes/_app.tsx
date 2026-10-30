import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";

import { AppShell } from "../components/app-shell";
import { RetryStatus, Status } from "../components/ui/layout";
import { Toaster } from "../components/ui/sonner";
import { OfflineDownloadProvider } from "../offline/offline-download-provider";
import { useSync } from "../progress/use-sync";
import { loadLearner } from "../progress/views";
import { useAppUpdate } from "../updates/use-app-update";

export const Route = createFileRoute("/_app")({
  // Progress lives on the device, so the server only sends the shell; the device fills it in.
  ssr: false,
  loader: async () => {
    await loadLearner();
  },
  pendingComponent: () => <Status loading title="opening fluenc" />,
  pendingMinMs: 0,
  errorComponent: StartupError,
  component: AppLayout,
});

function AppLayout() {
  const pathname = useLocation({ select: (location) => location.pathname });
  useSync();
  useAppUpdate();

  return (
    <OfflineDownloadProvider>
      <AppShell pathname={pathname}>
        <Outlet />
      </AppShell>
      <Toaster />
    </OfflineDownloadProvider>
  );
}

function StartupError() {
  return <RetryStatus title="couldn’t open your progress on this device" />;
}
