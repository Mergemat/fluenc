import { type QueryClient, queryOptions } from "@tanstack/react-query";

import type { LearnerState } from "../lib/learner-state";
import {
  type DashboardData,
  deriveDashboard,
  deriveLibrary,
  derivePalace,
  type LibraryData,
  type PalaceData,
} from "../lib/learner-views";
import {
  getCachedLearner,
  getOfflineLearner,
  type LearnerSnapshot,
} from "./progress";

// Each view is derived once per snapshot, however many components read it. The library and palace
// only depend on the state, which structural sharing keeps when a refetch changes nothing.
const dashboards = new WeakMap<LearnerSnapshot, DashboardData>();
const libraries = new WeakMap<LearnerState, LibraryData>();
const palaces = new WeakMap<LearnerState, PalaceData>();

function memoize<K extends object, V>(
  cache: WeakMap<K, V>,
  key: K,
  derive: () => V
) {
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const value = derive();
  cache.set(key, value);
  return value;
}

export const selectDashboard = (data: LearnerSnapshot) =>
  memoize(dashboards, data, () =>
    deriveDashboard(data.state, new Date(data.at))
  );
export const selectLibrary = (data: LearnerSnapshot) =>
  memoize(libraries, data.state, () => deriveLibrary(data.state));
export const selectPalace = (data: LearnerSnapshot) =>
  memoize(palaces, data.state, () => derivePalace(data.state));

export const learnerQueryOptions = queryOptions({
  queryKey: ["learner"],
  queryFn: ({ signal }) => getOfflineLearner(signal),
  networkMode: "always",
  // Re-read when the next card falls due so it moves into review.
  refetchInterval: (query) => {
    const nextReviewAt =
      query.state.data && selectDashboard(query.state.data).nextReviewAt;
    if (!nextReviewAt) {
      return false;
    }
    return Math.max(
      1000,
      Math.min(Date.parse(nextReviewAt) - Date.now(), 2_147_000_000)
    );
  },
});

export const dashboardQueryOptions = queryOptions({
  ...learnerQueryOptions,
  select: selectDashboard,
});
export const libraryQueryOptions = queryOptions({
  ...learnerQueryOptions,
  select: selectLibrary,
});
export const palaceQueryOptions = queryOptions({
  ...learnerQueryOptions,
  select: selectPalace,
});

export async function loadLearner(queryClient: QueryClient) {
  if (!queryClient.getQueryData(learnerQueryOptions.queryKey)) {
    const cached = await getCachedLearner();
    if (cached) {
      queryClient.setQueryData(learnerQueryOptions.queryKey, cached, {
        updatedAt: 0,
      });
    }
  }
  return queryClient.ensureQueryData({
    ...learnerQueryOptions,
    revalidateIfStale: true,
  });
}
