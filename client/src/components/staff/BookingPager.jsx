import { Pagination } from '../index.jsx';

/**
 * The pages the results run over, and how many rows one page holds.
 *
 * The desk pages through every booking 25 rows at a time, so the line under the
 * pager always says which rows are on screen and how many pages there are.
 */
export function BookingPager({ pages, page, onPage, total, perPage, filtered }) {
  return (
    <>
      <Pagination pages={pages} page={page} onPage={onPage} label="Pages of bookings" />
      <p className="small muted">
        {total === 0
          ? 'No booking matches these filters.'
          : pages <= 1
            ? `These ${total} ${total === 1 ? 'booking fits' : 'bookings fit'} one page. ${perPage} rows per page.`
            : `${total}${filtered ? ' matching' : ''} bookings page ${perPage} rows at a time. You are on page ${page} of ${pages}.`}
      </p>
    </>
  );
}
