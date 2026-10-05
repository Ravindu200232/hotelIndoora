/**
 * The bar at the top of every desk page: an optional breadcrumb, the page's
 * heading with its line of explanation, and the actions for that page on the
 * right. One component, so all of the desk's pages start the same way.
 */
import { Breadcrumb } from '../ui/primitives.jsx';

export function Topbar({ trail, title, note, actions, titleClass, style }) {
  return (
    <div className="topbar" style={style}>
      <div>
        {trail?.length ? <Breadcrumb trail={trail} /> : null}
        <h1 className={titleClass} style={{ marginBottom: 'var(--space-1)' }}>{title}</h1>
        {note ? <p className="small muted" style={{ margin: 0 }}>{note}</p> : null}
      </div>
      {actions ? <div className="topbar__actions">{actions}</div> : null}
    </div>
  );
}
