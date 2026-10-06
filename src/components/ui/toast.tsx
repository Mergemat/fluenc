import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

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
      <div className="dx-toast" data-visible={visible} role="status">
        {toast?.content}
      </div>
    </ToastContext>
  );
}

export const useToast = () => useContext(ToastContext);
