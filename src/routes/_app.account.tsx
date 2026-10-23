import { createFileRoute } from "@tanstack/react-router";

import { AccountView } from "../components/account-view";

export const Route = createFileRoute("/_app/account")({
  head: () => ({ meta: [{ title: "Account | Fluenc" }] }),
  component: AccountView,
});
