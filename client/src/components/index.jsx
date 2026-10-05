/**
 * One import for a page: every shared piece of the product's interface.
 *
 * The components are grouped by kind rather than by page, so no page invents
 * its own button, card, table row or empty state.
 */
import { Link } from 'react-router-dom';

export * from './ui/primitives.jsx';
export * from './ui/forms.jsx';
export * from './ui/feedback.jsx';
export * from './ui/data.jsx';
export * from './ui/media.jsx';
export * from './ui/overlays.jsx';
export * from './layout/headers.jsx';
export * from './layout/Topbar.jsx';

/** `Nav.Link` reads better than a bare Link inside product copy. */
export const Nav = { Link };
