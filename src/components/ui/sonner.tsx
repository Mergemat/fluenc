import { Toaster as Sonner } from "sonner";

/** Quiet toasts over the content, so they never shift layout. */
export function Toaster() {
  return (
    <Sonner
      // Above the mobile tab bar; centred on the page, not the window, beside the desktop sidebar.
      // Sonner's unlayered styles reset the margin, so the sidebar shift needs !important.
      className="[--toast-bottom:var(--spacing-safe-toast)] lg:ml-28! md:[--toast-bottom:var(--spacing-7)]"
      duration={2400}
      mobileOffset={{ bottom: "var(--toast-bottom)" }}
      offset={{ bottom: "var(--toast-bottom)" }}
      position="bottom-center"
      theme="dark"
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "type-control inset-x-0 mx-auto flex w-fit items-center gap-3 whitespace-nowrap rounded-lg border border-border-strong bg-popover px-3.5 py-2.5 text-foreground has-[button]:py-1.5 has-[button]:pr-1.5 leading-wrap shadow-toast",
          actionButton:
            "h-7 cursor-pointer rounded-md bg-blue px-2.5 text-primary-foreground focus-visible:outline-solid",
          // A mark before the message, like the hanzi just added, in green.
          title:
            "flex items-center gap-2 *:first:not-last:font-normal *:first:not-last:text-green *:first:not-last:text-xl",
        },
      }}
    />
  );
}
