import { useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  Outlet,
  useLocation,
  useRouter,
} from "@tanstack/react-router";
import { useCallback } from "react";

import { AppShell } from "../components/app-shell";
import { Status, statusAction } from "../components/ui/layout";
import { ToastProvider } from "../components/ui/toast";
import { OfflineDownloadProvider } from "../offline/offline-download-provider";
import { dashboardQueryOptions, loadLearner } from "../offline/queries";
import { useOfflineSync } from "../offline/use-offline-sync";
import { AppUpdateProvider } from "../updates/app-update-provider";

export const Route = createFileRoute("/_app")({
  // Progress lives on the device, so the server only sends the shell; the device fills it in.
  ssr: false,
  loader: async ({ context }) => {
    await loadLearner(context.queryClient);
  },
  pendingComponent: () => <Status loading title="opening fluenc" />,
  pendingMinMs: 0,
  errorComponent: StartupError,
  component: AppLayout,
});

function AppLayout() {
  const { data } = useSuspenseQuery(dashboardQueryOptions);
  const pathname = useLocation({ select: (location) => location.pathname });
  useOfflineSync();

  return (
    <ToastProvider>
      <AppUpdateProvider>
        <OfflineDownloadProvider>
          <AppShell data={data} pathname={pathname}>
            <Outlet />
          </AppShell>
        </OfflineDownloadProvider>
      </AppUpdateProvider>
    </ToastProvider>
  );
}

function StartupError() {
  const router = useRouter();
  const retry = useCallback(() => {
    router.invalidate();
  }, [router]);
  return (
    <Status
      action={
        <button className={statusAction} onClick={retry} type="button">
          try again
        </button>
      }
      title="couldn’t open your progress on this device"
    />
  );
}
