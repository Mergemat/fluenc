import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

// shadcn's Sonner, drawn in the app's own type and surfaces. The app is dark-only, so no
// next-themes.
const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner
    // Centred on the page, not the window: half the desktop sidebar's 216px over. Sonner's
    // positioning is unlayered CSS, so it takes !important.
    className="toaster group lg:left-[calc(50%+108px)]!"
    duration={2400}
    icons={{
      success: <CircleCheckIcon className="size-4" />,
      info: <InfoIcon className="size-4" />,
      warning: <TriangleAlertIcon className="size-4" />,
      error: <OctagonXIcon className="size-4" />,
      loading: <Loader2Icon className="size-4 animate-spin" />,
    }}
    // The page runs under the notch (viewport-fit=cover).
    mobileOffset={{ top: "var(--spacing-safe-toast)" }}
    position="top-center"
    theme="dark"
    toastOptions={{
      unstyled: true,
      classNames: {
        toast:
          "flex min-h-12 w-full items-center gap-3 rounded-lg border border-border-strong bg-popover py-2 pr-2.5 pl-4 text-popover-foreground shadow-popover",
        icon: "flex shrink-0 items-center",
        content: "flex min-w-0 flex-1 flex-col gap-1",
        title: "type-control text-md leading-wrap",
        description: "type-control text-muted-foreground leading-wrap",
        actionButton:
          "h-7 shrink-0 cursor-pointer rounded-md bg-foreground px-2.5 type-control text-background focus-visible:outline-solid",
        cancelButton:
          "h-7 shrink-0 cursor-pointer rounded-md px-2.5 type-control text-muted-foreground hover:text-foreground focus-visible:outline-solid",
      },
    }}
    {...props}
  />
);

export { Toaster };
