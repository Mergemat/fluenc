import { useRouter } from "@tanstack/react-router";
import { useCallback } from "react";

/** Return to the previous page in this app's history. */
export function useGoBack() {
  const router = useRouter();
  return useCallback(() => router.history.back(), [router]);
}
