import { createFileRoute, redirect } from "@tanstack/react-router";

// The palace moved under the profile; old links and bookmarks follow it.
export const Route = createFileRoute("/_app/palace/$")({
  beforeLoad: ({ location }) => {
    throw redirect({ href: `/profile${location.href}`, replace: true });
  },
});
