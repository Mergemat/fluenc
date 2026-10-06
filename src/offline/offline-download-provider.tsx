import { createContext, type ReactNode, useContext } from "react";

import {
  type OfflineDownload,
  useOfflineDownload,
} from "./use-offline-download";

const OfflineDownloadContext = createContext<OfflineDownload | null>(null);

export function OfflineDownloadProvider({ children }: { children: ReactNode }) {
  const offline = useOfflineDownload();
  return (
    <OfflineDownloadContext.Provider value={offline}>
      {children}
    </OfflineDownloadContext.Provider>
  );
}

export function useAppOfflineDownload() {
  const offline = useContext(OfflineDownloadContext);
  if (!offline) {
    throw new Error("Offline downloads require the app layout");
  }
  return offline;
}
