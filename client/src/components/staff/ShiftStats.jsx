import { Stat, Stats } from '../index.jsx';

/**
 * The day at a glance: the arrivals and departures on the board today, the
 * bookings still waiting for payment and the ones coming up.
 *
 * Every figure is counted from the desk's own dashboard answer, and each one
 * carries the detail that makes it useful — the first arrival time, the last
 * check-out, how many waiting bookings the desk took itself, and the next date
 * something is due.
 */
export function ShiftStats({ arrivals = [], departures = [], waiting = [], upcoming = [], checkOutTime }) {
  const firstArrival = arrivals
    .map((booking) => booking.expected_arrival_time)
    .filter(Boolean)
    .sort()[0];
  const takenByStaff = waiting.filter((booking) => booking.booked_by === 'staff').length;
  const nextStay = upcoming[0]?.check_in_date;

  return (
    <Stats>
      <Stat
        accent
        label="Today's arrivals"
        value={arrivals.length}
        foot={firstArrival ? `First at ${firstArrival}` : 'None expected'}
      />
      <Stat
        label="Today's departures"
        value={departures.length}
        foot={checkOutTime ? `Last by ${checkOutTime}` : 'None leaving'}
      />
      <Stat
        label="Waiting for payment"
        value={waiting.length}
        foot={waiting.length ? `${takenByStaff} taken by staff` : 'Nothing waiting'}
      />
      <Stat
        label="Upcoming bookings"
        value={upcoming.length}
        foot={nextStay
          ? `Next from ${new Date(nextStay).toDateString()}`
          : 'Nothing booked ahead'}
      />
    </Stats>
  );
}
