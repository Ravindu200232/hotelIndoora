/**
 * Dialogs and the radio rows that carry a choice with its price.
 *
 * The native dialog element is used, so the browser gives the focus trap, the
 * Escape key and the backdrop without a library, and the stylesheet the
 * prototype already has applies unchanged.
 */
import { useEffect, useRef } from 'react';

const join = (...parts) => parts.filter(Boolean).join(' ');

export function Dialog({ open, onClose, title, children, footer, label }) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal?.();
    if (!open && node.open) node.close?.();
  }, [open]);
  return (
    <dialog ref={ref} aria-label={label ?? title} onClose={onClose} onClick={(event) => { if (event.target === ref.current) onClose?.(); }}>
      <div className="dialog__body">
        <button className="dialog__close" type="button" onClick={onClose} aria-label="Close">✕</button>
        {title ? <h3>{title}</h3> : null}
        {children}
      </div>
      {footer ? <div className="dialog__foot">{footer}</div> : null}
    </dialog>
  );
}

/**
 * One choice in a list: a radio, what it is, and what it costs. Used by the
 * change-booking, new-booking and edit-booking screens, where the price and the
 * free-room count are part of the choice itself.
 */
export function OptionCard({ id, name, value, checked, disabled, onChange, title, note, detail, price, priceNote, badge, className, ...rest }) {
  return (
    <label className={join('option-card', disabled && 'option-card--off', className)} htmlFor={id} {...rest}>
      <input
        type="radio"
        id={id}
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      <span>
        <span className="cell-main">{title}</span>
        {note ? <span className="cell-sub">{note}</span> : null}
        {detail ? <span className="cell-sub">{detail}</span> : null}
        {badge ? <span className="cell-sub">{badge}</span> : null}
      </span>
      <span className="option-card__price">
        {price}
        {priceNote ? <span className="cell-sub">{priceNote}</span> : null}
      </span>
    </label>
  );
}
