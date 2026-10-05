/**
 * What the person is told while something is happening, and after.
 *
 * Every list and form has its loading, empty, error and success state; a
 * failure says what happened and offers a way to try again, and never shows a
 * stack trace or the name of a service behind the gateway.
 */
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const join = (...parts) => parts.filter(Boolean).join(' ');
const ICONS = { success: '✓', error: '!', warn: '!', info: 'i', pending: '…' };

export function Alert({ kind = 'info', title, children, className, hidden, style }) {
  return (
    <div className={join('alert', `alert--${kind}`, className)} role={kind === 'error' ? 'alert' : undefined} hidden={hidden} style={style}>
      <span className="alert__icon" aria-hidden="true">{ICONS[kind] ?? 'i'}</span>
      <div className="alert__body">
        {title ? <span className="alert__title">{title}</span> : null}
        {children}
      </div>
    </div>
  );
}

const ToastContext = createContext({ show: () => {} });

export function ToastProvider({ children }) {
  const [messages, setMessages] = useState([]);
  const show = useCallback((message, { icon = '✓', ms = 4200 } = {}) => {
    const id = Date.now() + Math.random();
    setMessages((current) => [...current, { id, message, icon }]);
    setTimeout(() => setMessages((current) => current.filter((entry) => entry.id !== id)), ms);
  }, []);
  const value = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-host" role="status" aria-live="polite">
        {messages.map((entry) => (
          <div className="toast" key={entry.id}>
            <span className="toast__icon" aria-hidden="true">{entry.icon}</span>
            <span>{entry.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/** A block of skeleton lines, shown while a page's real content loads. */
export function LoadingBlock({ label = 'Loading…', lines = 3 }) {
  return (
    <div className="panel" aria-busy="true">
      <p className="small muted" style={{ margin: 0 }}>{label}</p>
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonLine key={index} width={index === 0 ? '45%' : index === lines - 1 ? '65%' : '85%'} />
      ))}
    </div>
  );
}

export function SkeletonLine({ width = '100%', variant }) {
  return <span className={join('skeleton', variant && `skeleton--${variant}`)} style={{ display: 'block', width, marginTop: 'var(--space-3)' }} />;
}

/** The error state every list and form shares: what happened, and a way back. */
export function ErrorState({ title = 'Something went wrong', children, onRetry, retryLabel = 'Try again' }) {
  return (
    <div className="alert alert--error" role="alert">
      <span className="alert__icon" aria-hidden="true">!</span>
      <div className="alert__body">
        <span className="alert__title">{title}</span>
        {children}
        {onRetry ? (
          <div className="row" style={{ marginTop: 'var(--space-3)' }}>
            <button className="btn btn--ghost btn--sm" type="button" onClick={onRetry}>{retryLabel}</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function SuccessState({ title, children }) {
  return (
    <div className="alert alert--success" role="status">
      <span className="alert__icon" aria-hidden="true">✓</span>
      <div className="alert__body">
        <span className="alert__title">{title}</span>
        {children}
      </div>
    </div>
  );
}
