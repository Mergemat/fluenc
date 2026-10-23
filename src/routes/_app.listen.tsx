import { createFileRoute, redirect } from "@tanstack/react-router";

// Listening is part of Read now.
export const Route = createFileRoute("/_app/listen")({
  beforeLoad: () => {
    throw redirect({ to: "/reading", replace: true });
  },
});
