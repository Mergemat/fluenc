import { createFileRoute, redirect } from "@tanstack/react-router";

// Learn is the home page.
export const Route = createFileRoute("/_app/")({
  beforeLoad: () => {
    throw redirect({ to: "/lessons", replace: true });
  },
});
