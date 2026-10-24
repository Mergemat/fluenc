import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "../../lib/utils";

interface Toast {
  content: ReactNode;
  id: number;
}
const ToastContext = createContext<(content: ReactNode) => void>(
  () => undefined
);

/** One quiet, fixed-position toast; it overlays content so it never shifts layout. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback((content: ReactNode) => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), content });
    setVisible(true);
    timer.current = setTimeout(() => setVisible(false), 2400);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <ToastContext value={show}>
      {children}
      <div
        className={cn(
          // Centred on the page, not the window, beside the desktop sidebar.
          "type-control pointer-events-none fixed bottom-safe-toast left-1/2 z-60 flex -translate-x-1/2 items-center gap-tight whitespace-nowrap rounded-xl border border-border-strong bg-popover px-3.5 py-2.25 text-foreground leading-wrap shadow-toast transition duration-200 md:bottom-7 lg:ml-27",
          // A mark before the message, like the hanzi just added, in green.
          "*:first:not-last:font-normal *:first:not-last:text-18 *:first:not-last:text-green",
          visible ? "opacity-100" : "translate-y-2 opacity-0"
        )}
        role="status"
      >
        {toast?.content}
      </div>
    </ToastContext>
  );
}

export const useToast = () => useContext(ToastContext);
