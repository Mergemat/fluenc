import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { WelcomeView } from "../components/welcome-view";
import { markWelcomeSeen } from "../lib/welcome";

// Outside the app shell: the reel takes the whole screen, before any navigation.
export const Route = createFileRoute("/welcome")({
  ssr: false,
  component: Page,
});

function Page() {
  const navigate = useNavigate();
  const done = useCallback(
    (to: "/lessons" | "/today") => {
      markWelcomeSeen();
      navigate({ to, replace: true });
    },
    [navigate]
  );
  return <WelcomeView onDone={done} />;
}
