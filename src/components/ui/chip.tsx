import { type ButtonHTMLAttributes, type ReactNode, useCallback } from "react";

import { cn } from "../../lib/utils";
import { DitherGradient } from "../dither-kit/gradient";

type ChipProps<T extends string> = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "value" | "onSelect"
> & {
  pressed: boolean;
  children: ReactNode;
  /** With `onSelect`, a list of chips shares one handler that receives the chip's value. */
  value?: T;
  onSelect?: (value: T) => void;
};

/** A toggle chip; the pressed state is a quiet dither-kit fill, like the active nav chip. */
export function Chip<T extends string>({
  pressed,
  children,
  className,
  value,
  onSelect,
  onClick,
  ...props
}: ChipProps<T>) {
  const select = useCallback(() => {
    if (value !== undefined) {
      onSelect?.(value);
    }
  }, [onSelect, value]);
  return (
    <button
      aria-pressed={pressed}
      className={cn(
        "type-control relative isolate inline-flex h-8 items-center overflow-hidden rounded-md border border-border px-3 text-muted-foreground transition-colors hover:border-border-strong hover:text-foreground aria-pressed:border-blue aria-pressed:text-foreground",
        className
      )}
      onClick={onSelect ? select : onClick}
      type="button"
      {...props}
    >
      {pressed ? (
        <DitherGradient cell={2} direction="up" from="blue" opacity={0.45} />
      ) : null}
      <span className="relative inline-flex items-center gap-2">
        {children}
      </span>
    </button>
  );
}

/** A count inside a chip. */
export function ChipCount({ children }: { children: ReactNode }) {
  return <small className="text-xs tabular-nums opacity-60">{children}</small>;
}
