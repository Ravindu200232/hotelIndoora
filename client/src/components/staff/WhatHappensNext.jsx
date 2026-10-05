import { Link } from 'react-router-dom';
import { Panel } from '../index.jsx';

/**
 * What happens after the link goes out, in the order it happens — because the desk
 * says this to the guest on the phone, and the record has to match it.
 */
export function WhatHappensNext({ booking }) {
  return (
    <Panel tint style={{ marginTop: 'var(--space-5)' }}>
      <h4>What happens next</h4>
      <ol>
        <li>The guest pays the emailed link and lands on Payment Received, where the booking is confirmed with its reference.</li>
        <li>The booking then shows on Bookings as confirmed, beside the bookings guests made online.</li>
        <li>If the guest never pays, the desk opens the booking record and cancels it, which frees the room again.</li>
      </ol>
      <div className="row">
        {booking?.booking_reference ? (
          <Link className="btn btn--ghost btn--sm" to={`/bookings/${booking.booking_reference}/paid`}>Payment Received</Link>
        ) : null}
        {booking ? (
          <Link className="btn btn--ghost btn--sm" to={`/staff/bookings/${booking.id}`}>Booking Record</Link>
        ) : null}
        <Link className="btn btn--ghost btn--sm" to="/staff/bookings">Bookings</Link>
      </div>
    </Panel>
  );
}
