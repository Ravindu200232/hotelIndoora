/**
 * The shells: one public navigation, one for a signed-in guest, one for hotel
 * staff, and the minimal frame the sign-in pages use.
 *
 * Exactly as the prototype draws them: the same items in the same order, the
 * same account menu, the same footer with the hotel's own details, and the same
 * collapse into a menu button on a phone.
 */
import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { BrandMark } from '../ui/media.jsx';
import { NAV } from '../../routes.jsx';
import { useSession, homeFor } from '../../session.jsx';

const initialsOf = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || '··';

export function NavLinkItem({ to, children }) {
  return <NavLink className="nav__link" to={to} end={to === '/'}>{children}</NavLink>;
}

export function Logo({ to, tag }) {
  return (
    <Link className="brand" to={to}>
      <BrandMark />
      <span>
        <span className="brand__word">hotelIndoora</span>
        {tag ? <span className="brand__tag">{tag}</span> : null}
      </span>
    </Link>
  );
}

export function AccountMenu({ account, onSignOut }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const name = account?.full_name ?? '';
  return (
    <details className="account" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        <span className="account__avatar" aria-hidden="true">{initialsOf(name)}</span>
        <span className="account__meta">
          <span className="account__name">{name}</span>
          <span className="account__role">{account?.role === 'hotel_staff' ? 'Hotel Staff' : 'Guest'}</span>
        </span>
      </summary>
      <div className="account__menu">
        {account?.role === 'hotel_staff' ? (
          <>
            <Link to="/staff/hotel" aria-current={location.pathname === '/staff/hotel' ? 'page' : undefined}>Hotel Details</Link>
            <Link to="/staff/team">Team</Link>
          </>
        ) : (
          <>
            <Link to="/account">My Account</Link>
            <Link to="/my-bookings">My Bookings</Link>
          </>
        )}
        <button type="button" className="sign-out" onClick={onSignOut}>Sign out</button>
      </div>
    </details>
  );
}

/** The navigation, collapsed behind one button on a narrow screen. */
export function MobileNav({ id, items, actions, account, onSignOut }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="menu-toggle"
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="menu-toggle__bars" aria-hidden="true" /> Menu
      </button>
      <nav className={`nav nav--collapsible${open ? ' is-open' : ''}`} id={id} aria-label="Main">
        {items.map((item) => <NavLinkItem key={item.to} to={item.to}>{item.label}</NavLinkItem>)}
        <div className="nav__actions">
          {actions}
          {account ? <AccountMenu account={account} onSignOut={onSignOut} /> : null}
        </div>
      </nav>
    </>
  );
}

/** Signed out: the hotel's public pages, Sign in, and Sign up. */
export function PublicHeader() {
  const { account, signOut } = useSession();
  return (
    <header className="site-header">
      <div className="wrap site-header__inner">
        <Logo to="/" tag="Kinsale" />
        <MobileNav
          id="public-menu"
          items={NAV.public}
          account={account}
          onSignOut={signOut}
          actions={account ? null : (
            <>
              <Link className="btn btn--ghost btn--sm" to="/login">Sign in</Link>
              <Link className="btn btn--primary btn--sm" to="/register">Sign up</Link>
            </>
          )}
        />
      </div>
    </header>
  );
}

/** Signed in as a guest: their own bookings and account. */
export function GuestHeader() {
  const { account, signOut, role } = useSession();
  return (
    <header className="site-header">
      <div className="wrap site-header__inner">
        <Logo to={homeFor(role)} tag="Your stays" />
        <MobileNav id="guest-menu" items={NAV.guest} account={account} onSignOut={signOut} />
      </div>
    </header>
  );
}

/** Signed in as hotel staff: the five destinations of the desk. */
export function StaffHeader() {
  const { account, signOut } = useSession();
  return (
    <header className="site-header">
      <div className="wrap site-header__inner">
        <Logo to="/staff" tag="Hotel staff" />
        <MobileNav id="staff-menu" items={NAV.staff} account={account} onSignOut={signOut} />
      </div>
    </header>
  );
}

export function StaffSidebar() {
  const { account } = useSession();
  return (
    <aside className="sidebar">
      <div className="sidebar__inner">
        <span className="sidebar__brand">hotelIndoora</span>
        <span className="sidebar__role">Front desk</span>
        <p className="sidebar__user">
          <span className="account__avatar" aria-hidden="true">{initialsOf(account?.full_name)}</span>
          {' '}{account?.full_name} · Hotel Staff
        </p>
        <nav aria-label="Staff pages">
          <NavLink to="/staff" end>Dashboard</NavLink>
          <span className="sidebar__label">Manage</span>
          <NavLink to="/staff/room-types">Room Types</NavLink>
          <NavLink to="/staff/bookings">Bookings</NavLink>
          <NavLink to="/staff/team">Team</NavLink>
          <NavLink to="/staff/hotel">Hotel Details</NavLink>
        </nav>
        <p className="sidebar__note">
          Every staff account has the same full access to room types, rates, blocked dates, bookings, team and hotel
          details.
        </p>
      </div>
    </aside>
  );
}

/** The hotel's own details, in the footer of every page. */
export function Footer({ hotel }) {
  return (
    <footer className="site-footer">
      <div className="wrap site-footer__grid">
        <div>
          <h4>{hotel?.hotel_name ?? 'hotelIndoora'}</h4>
          <p>{hotel?.address ?? ''}</p>
          <p>{hotel ? `${hotel.phone_number} · ${hotel.email_address}` : ''}</p>
          <p>{hotel ? `Check-in from ${hotel.check_in_time} · Check-out by ${hotel.check_out_time}` : ''}</p>
          {hotel?.house_rules ? <p>{hotel.house_rules}</p> : null}
        </div>
        <div>
          <h4>Book directly</h4>
          <p>
            One room of one room type per booking. The nightly rate is the whole price, and you pay it through PayPal
            when you book.
          </p>
        </div>
        <nav className="site-footer__nav" aria-label="Footer">
          <Link to="/">Home</Link>
          <Link to="/rooms">Rooms</Link>
          <Link to="/login">Sign in</Link>
          <Link to="/my-bookings">My Bookings</Link>
        </nav>
      </div>
    </footer>
  );
}

/** The minimal frame the sign-in, sign-up and confirmation pages use. */
export function AuthFrame({ children, hotel }) {
  return (
    <div className="auth-frame">
      <div className="wrap auth-frame__top">
        <Logo to="/" tag="Kinsale" />
        <Link className="btn btn--ghost btn--sm" to="/">Back to home</Link>
      </div>
      {children}
      <footer className="site-footer">
        <div className="wrap">
          <p>
            <b>{hotel?.hotel_name ?? 'hotelIndoora'}</b>
            {hotel ? ` · ${hotel.address} · ${hotel.phone_number} · ${hotel.email_address}` : ''}
            {hotel ? ` · Check-in from ${hotel.check_in_time} · Check-out by ${hotel.check_out_time}` : ''}
          </p>
        </div>
      </footer>
    </div>
  );
}
