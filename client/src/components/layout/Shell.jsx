/**
 * The page shell: the right navigation for the person reading the page, the
 * hotel's details in the footer, and the desk's sidebar beside the staff pages.
 *
 * A public page a signed-in person can open shows the signed-in navigation, and
 * its calls to action change with it - the same rule the prototype follows.
 */
import { GuestHeader, PublicHeader, StaffHeader, StaffSidebar, Footer } from './headers.jsx';
import { SkipLink } from '../ui/primitives.jsx';
import { useSession } from '../../session.jsx';

export function SiteShell({ shell, hotel, children }) {
  const { signedIn, role } = useSession();

  if (shell === 'auth') return children;

  const header = shell === 'staff'
    ? <StaffHeader />
    : shell === 'guest'
      ? <GuestHeader />
      : (signedIn ? (role === 'hotel_staff' ? <StaffHeader /> : <GuestHeader />) : <PublicHeader />);

  const staffLayout = shell === 'staff';

  return (
    <>
      <SkipLink />
      {header}
      {staffLayout ? (
        <div className="wrap app-shell">
          <StaffSidebar />
          <main id="main">{children}</main>
        </div>
      ) : (
        <main id="main">{children}</main>
      )}
      <Footer hotel={hotel} />
    </>
  );
}
