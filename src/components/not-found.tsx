import { Link } from "@tanstack/react-router";

import { Page, Status } from "./ui/layout";

/** Any address the app doesn't know, instead of the router's bare "Not Found". */
export function NotFound() {
  return (
    <Page>
      <Status
        action={
          <Link className="dx-chip" to="/lessons">
            back to learn
          </Link>
        }
        title="this page isn’t in fluenc"
      />
    </Page>
  );
}
