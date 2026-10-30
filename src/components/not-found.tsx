import { MissingPage } from "./ui/layout";

/** Any address the app doesn't know, instead of the router's bare "Not Found". */
export function NotFound() {
  return (
    <MissingPage
      back="back to learn"
      link={{ to: "/lessons" }}
      title="this page isn’t in fluenc"
    />
  );
}
