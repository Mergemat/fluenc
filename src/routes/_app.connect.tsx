import { createFileRoute } from "@tanstack/react-router";

import { ConnectView } from "../components/connect-view";

// The OAuth provider signs this page's whole query, so it is read as-is rather than through
// validateSearch, which could rewrite it.
export const Route = createFileRoute("/_app/connect")({
  ssr: false,
  head: () => ({ meta: [{ title: "Connect | Fluenc" }] }),
  component: Page,
});

function Page() {
  const clientId = new URLSearchParams(window.location.search).get("client_id");
  return <ConnectView clientId={clientId} />;
}
