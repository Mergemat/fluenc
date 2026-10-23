import { createFileRoute } from "@tanstack/react-router";

import { ProfileView } from "../components/profile-view";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Profile | Fluenc" }] }),
  component: ProfileView,
});
