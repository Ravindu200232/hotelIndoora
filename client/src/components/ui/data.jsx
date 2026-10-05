/**
 * Tables, lists and the small blocks that carry a record: one component per
 * kind, so a table row on the desk's pages and a table row on the guest's pages
 * are the same row.
 *
 * On a narrow screen a table becomes stacked rows, each cell labelled by the
 * column it came from, exactly as the prototype's stylesheet lays it out.
 */
import { Link } from 'react-router-dom';

const join = (...parts) => parts.filter(Boolean).join(' ');

export function TableWrap({ children, className }) {
  return <div className={join('table-wrap', className)}>{children}</div>;
}

export function Table({ children, className, receipt, ...rest }) {
  return <table className={join(receipt && 'receipt', className)} {...rest}>{children}</table>;
}

export function Caption({ children, hidden }) {
  return <caption className={hidden ? 'visually-hidden' : undefined}>{children}</caption>;
}

export function Thead({ columns = [], children }) {
  return (
    <thead>
      {children ?? (
        <tr>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr>
      )}
    </thead>
  );
}

export function Tbody({ children }) { return <tbody>{children}</tbody>; }
export function Tfoot({ children }) { return <tfoot>{children}</tfoot>; }
export function Tr({ children, ...rest }) { return <tr {...rest}>{children}</tr>; }
export function Th({ scope = 'col', children, ...rest }) { return <th scope={scope} {...rest}>{children}</th>; }

/** `label` is what a stacked mobile row shows above the value. */
export function Td({ label, children, ...rest }) {
  return <td data-label={label} {...rest}>{children}</td>;
}

export function CellMain({ children }) { return <span className="cell-main">{children}</span>; }
export function CellSub({ children }) { return <span className="cell-sub">{children}</span>; }

export function Pagination({ pages = 1, page = 1, onPage, label = 'Pages' }) {
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label={label}>
      <button className="btn btn--ghost btn--sm" type="button" disabled={page <= 1} onClick={() => onPage?.(page - 1)}>Previous</button>
      {Array.from({ length: pages }).map((_, index) => (
        <button
          key={index}
          type="button"
          className="btn btn--ghost btn--sm"
          aria-current={index + 1 === page ? 'page' : undefined}
          onClick={() => onPage?.(index + 1)}
        >
          {index + 1}
        </button>
      ))}
      <button className="btn btn--ghost btn--sm" type="button" disabled={page >= pages} onClick={() => onPage?.(page + 1)}>Next</button>
    </nav>
  );
}

/** Label-and-value rows: the stay, the guest, a breakdown of money. */
export function KvList({ rows = [], stacked, children }) {
  return (
    <dl className={join('kv', stacked && 'kv--stack')}>
      {children ?? rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PlainList({ items = [], children }) {
  return (
    <ul className="plain-list">
      {children ?? items.map((item) => (
        <li key={item.label ?? item}>
          <span>{item.label ?? item}</span>
          {item.value !== undefined ? <b>{item.value}</b> : null}
          {item.action ?? null}
        </li>
      ))}
    </ul>
  );
}

export function AmenityList({ items = [] }) {
  return <ul className="amenities">{items.map((item) => <li key={item}>{item}</li>)}</ul>;
}

export function Steps({ steps = [], current = 0 }) {
  return (
    <ol className="steps">
      {steps.map((step, index) => (
        <li
          key={step}
          className={index < current ? 'done' : undefined}
          aria-current={index === current ? 'step' : undefined}
        >
          <span aria-hidden="true">{index < current ? '✓' : index + 1}</span> {step}
        </li>
      ))}
    </ol>
  );
}

export function List({ children, className }) { return <ul className={join('list', className)}>{children}</ul>; }

export function ListItem({ title, to, sub, side, children }) {
  return (
    <li>
      <div className="list__main">
        {title ? (to ? <Link className="list__title" to={to}>{title}</Link> : <span className="list__title">{title}</span>) : null}
        {sub ? <span className="list__sub">{sub}</span> : null}
        {children}
      </div>
      {side ? <div className="list__side">{side}</div> : null}
    </li>
  );
}

/** The months of out-of-service nights on the blocked-dates page. */
export function BarTrack({ bars = [] }) {
  return (
    <div className="bar-track">
      {bars.map((bar) => (
        <div key={bar.label} className={join('bar', bar.outOfService && 'bar--out')}>
          <i style={{ height: `${bar.height ?? 8}px` }} />
          {bar.label}
        </div>
      ))}
    </div>
  );
}
