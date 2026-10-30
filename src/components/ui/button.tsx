import type { LucideIcon } from "lucide-react";

import { cn } from "../../lib/utils";
import { DitherButton, type DitherButtonProps } from "../dither-kit/button";
import { action, actionKey, tool } from "./buttons";

/** The one big action on a study screen or a card: what it does, and the key that does it too. */
export function ActionButton({
  hint,
  alert = false,
  className,
  children,
  ...props
}: DitherButtonProps & {
  /** The key that does the same, shown at the end. */
  hint: string;
  /** The label says something went wrong: read it out when it changes to that. */
  alert?: boolean;
}) {
  return (
    <DitherButton className={cn(action, className)} {...props}>
      <span role={alert ? "alert" : undefined}>{children}</span>
      <kbd className={actionKey}>{hint}</kbd>
    </DitherButton>
  );
}

const tones = {
  primary: { color: "blue", variant: "gradient" },
  quiet: { color: "grey", variant: "dotted" },
  danger: { color: "red", variant: "dotted" },
} as const;

/** A small labelled tool: settings rows, forms, toggles beside content. */
export function ToolButton({
  icon: Icon,
  tone,
  className,
  children,
  ...props
}: Omit<DitherButtonProps, "color" | "variant"> & {
  icon?: LucideIcon;
  tone: keyof typeof tones;
}) {
  return (
    <DitherButton className={cn(tool, className)} {...tones[tone]} {...props}>
      {Icon ? <Icon className="shrink-0" size={13} /> : null}
      {children}
    </DitherButton>
  );
}
