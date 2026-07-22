import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react'

type ToastTone = 'success' | 'error' | 'info'
type ToastItem = { id: number; message: string; tone: ToastTone }
type ConfirmState = { title: string; message: string; confirmLabel: string; danger: boolean; alertOnly?: boolean; resolve: (value: boolean) => void }
type FeedbackContextValue = {
  toast: (message: string, tone?: ToastTone) => void
  confirm: (options: { title: string; message: string; confirmLabel?: string; danger?: boolean }) => Promise<boolean>
  alert: (options: { title: string; message: string; confirmLabel?: string; danger?: boolean }) => Promise<void>
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null)

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
  const toast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(current => [...current, { id, message, tone }])
    window.setTimeout(() => setToasts(current => current.filter(item => item.id !== id)), 3200)
  }, [])
  const confirm = useCallback((options: { title: string; message: string; confirmLabel?: string; danger?: boolean }) => new Promise<boolean>(resolve => {
    setConfirmState({ title: options.title, message: options.message, confirmLabel: options.confirmLabel || '确认', danger: !!options.danger, resolve })
  }), [])
  const alert = useCallback((options: { title: string; message: string; confirmLabel?: string; danger?: boolean }) => new Promise<void>(resolve => {
    setConfirmState({ title: options.title, message: options.message, confirmLabel: options.confirmLabel || '知道了', danger: !!options.danger, alertOnly: true, resolve: () => resolve() })
  }), [])
  const closeConfirm = (value: boolean) => {
    if (!confirmState) return
    confirmState.resolve(value)
    setConfirmState(null)
  }
  const value = useMemo(() => ({ toast, confirm, alert }), [alert, confirm, toast])
  return <FeedbackContext.Provider value={value}>
    {children}
    <div className="toast-viewport" aria-live="polite">{toasts.map(item => <div key={item.id} className={`app-toast ${item.tone}`}>{item.message}</div>)}</div>
    {confirmState && <div className="modal-bg feedback-modal-bg" role="presentation" onMouseDown={() => closeConfirm(false)}>
      <section className={`feedback-confirm ${confirmState.danger ? 'danger-tone' : ''}`} role="dialog" aria-modal="true" aria-labelledby="feedback-confirm-title" onMouseDown={event => event.stopPropagation()}>
        <header><div className="feedback-confirm-heading">{confirmState.danger && <span aria-hidden="true">!</span>}<div><small>{confirmState.danger ? '危险操作' : '操作确认'}</small><h2 id="feedback-confirm-title">{confirmState.title}</h2></div></div><button className="plain-close" aria-label="关闭" onClick={() => closeConfirm(false)}>×</button></header>
        <p>{confirmState.message}</p>
        <footer>{!confirmState.alertOnly && <button className="feedback-cancel" onClick={() => closeConfirm(false)}>取消</button>}<button className={confirmState.danger ? 'danger' : 'primary'} onClick={() => closeConfirm(true)}>{confirmState.confirmLabel}</button></footer>
      </section>
    </div>}
  </FeedbackContext.Provider>
}

export function useFeedback() {
  const value = useContext(FeedbackContext)
  if (!value) throw new Error('useFeedback 必须在 FeedbackProvider 内使用')
  return value
}
