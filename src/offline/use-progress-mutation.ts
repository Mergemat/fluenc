import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { LearnerSnapshot } from "./progress";
import { learnerQueryOptions } from "./queries";

/** Save progress on the device. It shows at once; sync sends it when it can. */
export function useProgressMutation<T>(
  save: (input: T) => Promise<LearnerSnapshot>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["progress"],
    scope: { id: "progress" },
    networkMode: "always",
    mutationFn: save,
    onSuccess: (snapshot) => {
      queryClient.setQueryData(learnerQueryOptions.queryKey, snapshot);
    },
  });
}
