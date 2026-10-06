import { useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  Outlet,
  useLocation,
  useRouter,
} from "@tanstack/react-router";
import { useCallback } from "react";

import { AppShell } from "../components/app-shell";
import { Button } from "../components/ui/button";
import { Status } from "../components/ui/layout";
import { OfflineDownloadProvider } from "../offline/offline-download-provider";
import { dashboardQueryOptions, loadLearner } from "../offline/queries";
import { useOfflineSync } from "../offline/use-offline-sync";
import { AppUpdateProvider } from "../updates/app-update-provider";

export const Route = createFileRoute("/_app")({
  loader: async ({ context }) => {
    await loadLearner(context.queryClient);
  },
  pendingComponent: () => <Status title="Opening Fluenc…" />,
  pendingMinMs: 0,
  errorComponent: StartupError,
  component: AppLayout,
});

function AppLayout() {
  const { data } = useSuspenseQuery(dashboardQueryOptions);
  const pathname = useLocation({ select: (location) => location.pathname });
  useOfflineSync();

  return (
    <AppUpdateProvider>
      <OfflineDownloadProvider>
        <AppShell data={data} pathname={pathname}>
          <Outlet />
        </AppShell>
      </OfflineDownloadProvider>
    </AppUpdateProvider>
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
        <Button onClick={retry} type="button">
          Try again
        </Button>
      }
      title="Could not open your lessons. Connect to the internet to prepare Fluenc for offline use."
    />
  );
}
