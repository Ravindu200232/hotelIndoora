/**
 * One component per kind, using the prototype's own class names.
 *
 * Every page imports these, so two buttons of the same kind on two different
 * pages are the same button: the padding, radius, size and states come from
 * `styles/app.css`, which was ported from the approved prototype unchanged.
 */
import { Link } from 'react-router-dom';

const join = (...parts) => parts.filter(Boolean).join(' ');

export function Button({ as, to, href, kind = 'primary', size, block, children, ...rest }) {
  const className = join('btn', `btn--${kind}`, size === 'sm' && 'btn--sm', block && 'btn--block', rest.className);
  const { className: _ignored, ...props } = rest;
  if (to) return <Link className={className} to={to} {...props}>{children}</Link>;
  if (href) return <a className={className} href={href} {...props}>{children}</a>;
  const Component = as ?? 'button';
  return <Component className={className} type={Component === 'button' ? (props.type ?? 'button') : props.type} {...props}>{children}</Component>;
}

export function LinkArrow({ to, children, ...rest }) {
  return <Link className={join('link-arrow', rest.className)} to={to} {...rest}>{children}</Link>;
}

export function Chip({ children, className }) {
  return <span className={join('chip', className)}>{children}</span>;
}

/** Status labels: confirmed, waiting for payment, cancelled, on sale, off sale. */
export function Badge({ kind = 'neutral', children, className }) {
  return <span className={join('badge', `badge--${kind}`, className)}>{children}</span>;
}

export function Ref({ children, className }) {
  return <span className={join('ref', className)}>{children}</span>;
}

export function Avatar({ initials, className }) {
  return <span className={join('account__avatar', className)} aria-hidden="true">{initials}</span>;
}

export function Price({ amount, per, className }) {
  return (
    <p className={join('price', className)}>
      {amount}
      {per ? <> <small>{per}</small></> : null}
    </p>
  );
}

export function Eyebrow({ children, className, style }) {
  return <p className={join('eyebrow', className)} style={style}>{children}</p>;
}

export function Skeleton({ variant, className, style }) {
  return <span className={join('skeleton', variant && `skeleton--${variant}`, className)} style={style} />;
}

export function EmptyState({ title, children, action }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {typeof children === 'string' ? <p>{children}</p> : children}
      {action}
    </div>
  );
}

export function Card({ children, className, as: Component = 'div', ...rest }) {
  return <Component className={join('card', className)} {...rest}>{children}</Component>;
}
export function CardMedia({ children }) { return <div className="card__media">{children}</div>; }
export function CardBody({ children }) { return <div className="card__body">{children}</div>; }
export function CardFoot({ children }) { return <div className="card__foot">{children}</div>; }
export function CardFlag({ children }) { return <span className="card__flag">{children}</span>; }
export function CardTitle({ to, children }) {
  return <h3 className="card__title">{to ? <Link to={to}>{children}</Link> : children}</h3>;
}
export function CardMeta({ children }) { return <p className="card__meta">{children}</p>; }

export function Panel({ tint, accent, className, children, as: Component = 'div', ...rest }) {
  return (
    <Component className={join('panel', tint && 'panel--tint', accent && 'panel--accent', className)} {...rest}>
      {children}
    </Component>
  );
}

export function Stats({ children, className }) {
  return <ul className={join('stats', className)} style={{ listStyle: 'none', padding: 0 }}>{children}</ul>;
}

export function Stat({ label, value, foot, accent, className }) {
  return (
    <li className={join('stat', accent && 'stat--accent', className)}>
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
      {foot ? <span className="stat__foot">{foot}</span> : null}
    </li>
  );
}

export function SectionHead({ title, note, action, children }) {
  return (
    <div className="section__head">
      <div>
        {title ? <h2>{title}</h2> : null}
        {note ? <p>{note}</p> : null}
        {children}
      </div>
      {action}
    </div>
  );
}

export function Breadcrumb({ trail = [] }) {
  return (
    <p className="breadcrumb">
      {trail.map((step, index) => (
        <span key={step.label}>
          {index > 0 ? ' / ' : ''}
          {step.to ? <Link to={step.to}>{step.label}</Link> : step.label}
        </span>
      ))}
    </p>
  );
}

export function RowActions({ children }) { return <div className="row-actions">{children}</div>; }
/**
 * A bar that fills as something real progresses. `announce` turns it into a
 * progress bar a screen reader can read out, which is how an upload is reported.
 */
export function ProgressTrack({ percent = 0, announce = false, label }) {
  if (announce) {
    return (
      <div
        className="progress-track"
        role="progressbar"
        aria-label={label}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <i style={{ width: `${percent}%` }} />
      </div>
    );
  }
  return <div className="progress-track" aria-hidden="true"><i style={{ width: `${percent}%` }} /></div>;
}
export function MiniMap({ title, children }) {
  return <div className="mini-map">{title ? <b>{title}</b> : null}{children}</div>;
}
export function StayBand({ from, nights, rate, to }) {
  return (
    <div className="stay-band">
      <div>
        <h4 style={{ marginBottom: 'var(--space-1)' }}>Check-in</h4>
        <p style={{ margin: 0 }}><b>{from}</b></p>
        <p className="small muted" style={{ margin: 0 }}>from 15:00</p>
      </div>
      <div className="stay-band__mid">
        <span>{nights} nights · {rate} a night</span>
        <div className="stay-band__line" aria-hidden="true" />
      </div>
      <div className="right">
        <h4 style={{ marginBottom: 'var(--space-1)' }}>Check-out</h4>
        <p style={{ margin: 0 }}><b>{to}</b></p>
        <p className="small muted" style={{ margin: 0 }}>by 11:00</p>
      </div>
    </div>
  );
}

export function VisuallyHidden({ children }) { return <span className="visually-hidden">{children}</span>; }

export function SkipLink() { return <a className="skip-link" href="#main">Skip to content</a>; }

export function Stack({ as: Component = 'div', children, className, ...rest }) {
  return <Component className={join('stack', className)} {...rest}>{children}</Component>;
}
export function Row({ children, className, between, end, style }) {
  return <div className={join('row', between && 'row--between', end && 'row--end', className)} style={style}>{children}</div>;
}
export function Grid({ columns = 2, className, children, ...rest }) {
  return <div className={join('grid', `grid--${columns}`, className)} {...rest}>{children}</div>;
}
export function Split({ even, className, children }) {
  return <div className={join('split', even && 'split--even', className)}>{children}</div>;
}
