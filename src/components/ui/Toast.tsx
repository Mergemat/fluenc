import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

type Toast = { id: number; content: ReactNode }
const ToastContext = createContext<(content: ReactNode) => void>(() => {})

/** One quiet, fixed-position toast; it overlays content so it never shifts layout. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null)
  const [visible, setVisible] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const show = useCallback((content: ReactNode) => {
    clearTimeout(timer.current)
    setToast({ id: Date.now(), content })
    setVisible(true)
    timer.current = setTimeout(() => setVisible(false), 2400)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  return <ToastContext value={show}>
    {children}
    <div className="dx-toast" role="status" data-visible={visible}>{toast?.content}</div>
  </ToastContext>
}

export const useToast = () => useContext(ToastContext)
