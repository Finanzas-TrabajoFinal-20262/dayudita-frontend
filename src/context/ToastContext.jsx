import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

const DURATIONS = { error: 8000, success: 5000, warning: 15000 }

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())
  const nextId = useRef(1)

  const toastsRef = useRef([])
  toastsRef.current = toasts

  const dismiss = useCallback(id => {
    clearTimeout(timers.current.get(id))
    timers.current.delete(id)
    const toast = toastsRef.current.find(item => item.id === id)
    setToasts(current => current.filter(item => item.id !== id))
    toast?.onDismiss?.()
  }, [])

  const notify = useCallback((message, tone = 'success', onDismiss) => {
    if (!message) return
    const existing = toastsRef.current.find(item => item.message === message && item.tone === tone)
    const id = existing ? existing.id : nextId.current++
    clearTimeout(timers.current.get(id))
    timers.current.set(id, setTimeout(() => dismiss(id), DURATIONS[tone] || DURATIONS.success))
    const toast = { id, message, tone, onDismiss }
    toastsRef.current = existing
      ? toastsRef.current.map(item => (item.id === id ? toast : item))
      : [...toastsRef.current, toast]
    setToasts(current => (
      current.some(item => item.id === id)
        ? current.map(item => (item.id === id ? toast : item))
        : [...current, toast]
    ))
  }, [dismiss])

  useEffect(() => () => timers.current.forEach(timer => clearTimeout(timer)), [])

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
            <span>{toast.message}</span>
            <button type="button" className="toast-close" onClick={() => dismiss(toast.id)} aria-label="Cerrar notificación">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

export function ToastMessage({ message, tone = 'error', onClose }) {
  const notify = useToast()
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (message) notify(message, tone, () => onCloseRef.current?.())
  }, [message, tone, notify])

  return null
}
