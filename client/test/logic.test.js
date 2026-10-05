import { describe, it, expect } from 'vitest';
import {
  addDays, formatDate, formatDaySpan, formatLongDate, formatRange, formatShortDate,
  formatStayRange, formatTime, money, nightsBetween, stayLabel, todayIso,
} from '../src/api.js';
import { validateRoomType } from '../src/components/staff/RoomTypeForm.jsx';
import { nightsInRange, validateBlock } from '../src/components/staff/BlockForm.jsx';
import { validateInvite } from '../src/components/staff/InviteForm.jsx';
import { validateHotelDetails } from '../src/components/staff/HotelDetailsForm.jsx';
import { validateStay } from '../src/components/staff/DatesRoomPicker.jsx';
import { validateGuest } from '../src/components/staff/GuestStayForm.jsx';
import { photoProblem } from '../src/components/staff/PhotoUploader.jsx';

/**
 * The product's own arithmetic and its field rules, away from a browser.
 *
 * Every rule here is the one the service holds the same input to, so a form that
 * accepts something the server refuses — or the other way round — shows up as a
 * failure rather than as a page that behaves differently from the door behind it.
 */
const iso = (offset) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

describe('the money and the dates as the pages write them', () => {
  it('writes one euro amount the same way everywhere', () => {
    expect(money(360)).toBe('€360.00');
    expect(money(228.5)).toBe('€228.50');
    expect(money(null)).toBe('€0.00');
  });

  it('writes a stay the way each screen needs it', () => {
    expect(formatDate('2026-06-12')).toBe('Fri 12 June 2026');
    expect(formatRange('2026-06-12', '2026-06-15')).toBe('Fri 12 Jun → Mon 15 Jun 2026');
    expect(formatShortDate('2026-05-12')).toBe('Tue 12 May');
    expect(formatStayRange('2026-05-13', '2026-05-15', 2)).toBe('Wed 13 – Fri 15 May · 2 nights');
    expect(formatDaySpan('2026-05-14', '2026-05-16')).toBe('14–16 May');
    expect(formatDaySpan('2026-05-30', '2026-06-02')).toBe('30 May – 2 Jun');
    expect(formatLongDate('2026-05-12')).toBe('Tuesday 12 May 2026');
    expect(stayLabel('2026-05-12', '2026-05-15', 2)).toBe('12 – 15 May 2026 · 3 nights · 2 guests');
  });

  it('counts the nights of a stay, and never counts backwards', () => {
    expect(nightsBetween('2026-06-12', '2026-06-15')).toBe(3);
    expect(nightsBetween('2026-06-12', '2026-06-12')).toBe(0);
    expect(nightsBetween('2026-06-15', '2026-06-12')).toBe(0);
    expect(addDays('2026-05-12', 3)).toBe('2026-05-15');
    expect(todayIso()).toBe(new Date().toISOString().slice(0, 10));
  });

  it('reads a clock time in the desk\'s own day', () => {
    expect(formatTime(new Date(2026, 4, 12, 8, 32))).toBe('08:32');
    expect(formatTime(new Date(2026, 4, 12, 18, 5))).toBe('18:05');
    expect(formatTime('not a date')).toBe('—');
  });
});

describe('the rules a room type is held to', () => {
  const valid = {
    name: 'Garden Double',
    nightly_rate: '180.00',
    room_count: '6',
    max_guests: '3',
    room_size_sqm: '24',
    description: 'A calm double room on the garden side.',
  };

  it('accepts a room type that is entirely within the bounds', () => {
    expect(validateRoomType(valid)).toEqual({});
    expect(validateRoomType({ ...valid, room_size_sqm: '', nightly_rate: '0.01', room_count: '500', max_guests: '20' })).toEqual({});
  });

  it('refuses a name outside 2 to 120 characters', () => {
    expect(validateRoomType({ ...valid, name: '' }).name).toContain('name guests see');
    expect(validateRoomType({ ...valid, name: 'G' }).name).toContain('between 2 and 120');
    expect(validateRoomType({ ...valid, name: 'G'.repeat(121) }).name).toContain('between 2 and 120');
  });

  it('refuses a rate at or below zero, above the ceiling, or with three decimals', () => {
    expect(validateRoomType({ ...valid, nightly_rate: '0' }).nightly_rate).toContain('above 0.00');
    expect(validateRoomType({ ...valid, nightly_rate: '' }).nightly_rate).toContain('above 0.00');
    expect(validateRoomType({ ...valid, nightly_rate: '100000' }).nightly_rate).toContain('above 0.00');
    expect(validateRoomType({ ...valid, nightly_rate: '180.005' }).nightly_rate).toContain('two decimal places');
  });

  it('refuses a room count, a party or a size the hotel cannot sell', () => {
    expect(validateRoomType({ ...valid, room_count: '0' }).room_count).toContain('1 and 500');
    expect(validateRoomType({ ...valid, room_count: '501' }).room_count).toContain('1 and 500');
    expect(validateRoomType({ ...valid, room_count: '2.5' }).room_count).toContain('1 and 500');
    expect(validateRoomType({ ...valid, max_guests: '21' }).max_guests).toContain('1 and 20');
    expect(validateRoomType({ ...valid, room_size_sqm: '0' }).room_size_sqm).toContain('above zero');
    expect(validateRoomType({ ...valid, room_size_sqm: '24.05' }).room_size_sqm).toContain('one decimal place');
    expect(validateRoomType({ ...valid, description: 'x'.repeat(2001) }).description).toContain('2,000 characters');
  });
});

describe('the nights a block takes out of service', () => {
  it('counts both ends of the range', () => {
    expect(nightsInRange('2026-06-10', '2026-06-13')).toBe(4);
    expect(nightsInRange('2026-06-10', '2026-06-10')).toBe(1);
    expect(nightsInRange('2026-06-13', '2026-06-10')).toBe(0);
    expect(nightsInRange('', '')).toBe(0);
  });

  it('refuses a range without both nights, a backwards range, and a reason the team cannot read', () => {
    expect(validateBlock({ first_night: '', last_night: '', reason: 'painting' }).first_night).toContain('first night');
    expect(validateBlock({ first_night: '2026-06-10', last_night: '', reason: 'painting' }).last_night).toContain('last night');
    expect(validateBlock({ first_night: '2026-06-10', last_night: '2026-06-09', reason: 'painting' }).last_night).toContain('on or after 10 Jun');
    expect(validateBlock({ first_night: '2026-06-10', last_night: '2026-06-13', reason: 'ab' }).reason).toContain('3 and 200');
    expect(validateBlock({ first_night: '2026-06-10', last_night: '2026-06-13', reason: 'x'.repeat(201) }).reason).toContain('3 and 200');
  });

  it('accepts a range the hotel can act on', () => {
    expect(validateBlock({ first_night: '2026-06-10', last_night: '2026-06-13', reason: 'Repainting rooms 12–14' })).toEqual({});
  });
});

describe('the rules a colleague\'s invitation is held to', () => {
  it('accepts a name and an address of the colleague\'s own', () => {
    expect(validateInvite({ full_name: 'Hana Suzuki', email: 'hana.suzuki@hotelindoora.com' })).toEqual({});
  });

  it('refuses a missing or oversized name, and an address that is not one', () => {
    expect(validateInvite({}).full_name).toContain('full name');
    expect(validateInvite({ full_name: 'H' }).full_name).toContain('between 2 and 120');
    expect(validateInvite({ full_name: 'Hana Suzuki' }).email).toContain('email address');
    expect(validateInvite({ full_name: 'Hana Suzuki', email: 'hana@' }).email).toContain('correct format');
    expect(validateInvite({ full_name: 'Hana Suzuki', email: `${'a'.repeat(250)}@example.com` }).email).toContain('too long');
  });
});

describe('the rules the hotel\'s public details are held to', () => {
  const valid = {
    hotel_name: 'hotelIndoora',
    address: '14 Harbour Lane, Kinsale, Co. Cork, Ireland',
    phone_number: '+353 21 477 0128',
    email_address: 'stay@hotelindoora.com',
    check_in_time: '11:00',
    check_out_time: '15:00',
  };

  it('accepts a check-out time later than the check-in time, as FR-126 requires', () => {
    expect(validateHotelDetails(valid)).toEqual({});
    expect(validateHotelDetails({ ...valid, check_in_time: '11:00', check_out_time: '15:00' })).toEqual({});
  });

  it('refuses an address that is too short to be one, and a phone number or address that is not one', () => {
    expect(validateHotelDetails({ ...valid, address: 'Kinsale' }).address).toContain('between 10 and 300');
    expect(validateHotelDetails({ ...valid, hotel_name: '' }).hotel_name).toContain('hotel name');
    expect(validateHotelDetails({ ...valid, phone_number: 'ring us' }).phone_number).toContain('digits');
    expect(validateHotelDetails({ ...valid, email_address: 'stay@hotelindoora' }).email_address).toContain('correct format');
  });

  it('refuses a check-out time that is not later than the check-in time, and a time that is not a time', () => {
    expect(validateHotelDetails({ ...valid, check_out_time: '09:00' }).check_out_time).toContain('later than the check-in');
    expect(validateHotelDetails({ ...valid, check_out_time: '11:00' }).check_out_time).toContain('later than the check-in');
    expect(validateHotelDetails({ ...valid, check_in_time: '3pm' }).check_in_time).toContain('HH:MM');
    expect(validateHotelDetails({ ...valid, check_out_time: '25:00' }).check_out_time).toContain('HH:MM');
  });
});

describe('the rules the desk\'s own booking form is held to', () => {
  it('accepts nights that are ahead and a party the hotel can take', () => {
    expect(validateStay({ check_in_date: iso(1), check_out_date: iso(4), guest_count: '2' })).toEqual({});
  });

  it('refuses a night in the past, a check-out that is not later, and a party outside 1 to 20', () => {
    expect(validateStay({ check_in_date: '', check_out_date: iso(4), guest_count: '2' }).check_in_date).toContain('arrives');
    expect(validateStay({ check_in_date: iso(-3), check_out_date: iso(4), guest_count: '2' }).check_in_date).toContain('from today onwards');
    expect(validateStay({ check_in_date: iso(4), check_out_date: iso(4), guest_count: '2' }).check_out_date).toContain('later than the check-in');
    expect(validateStay({ check_in_date: iso(1), check_out_date: iso(4), guest_count: '0' }).guest_count).toContain('1 and 20');
    expect(validateStay({ check_in_date: iso(1), check_out_date: iso(4), guest_count: '21' }).guest_count).toContain('1 and 20');
  });

  it('accepts a guest whose details all hold, and refuses each one that does not', () => {
    const good = {
      lead_guest_name: 'Ilse Brandt',
      guest_email: 'ilse.brandt@example.com',
      contact_phone: '+49 171 555 0142',
      guest_count: '3',
      expected_arrival_time: '15:30',
      special_requests: 'Travelling with a small dog.',
    };
    expect(validateGuest(good, { maxGuests: 3, checkInTime: '15:00' })).toEqual({});

    expect(validateGuest({ ...good, lead_guest_name: '' }).lead_guest_name).toContain('full name');
    expect(validateGuest({ ...good, guest_email: 'ilse@' }).guest_email).toContain('correct format');
    expect(validateGuest({ ...good, contact_phone: 'call me' }).contact_phone).toContain('digits');
    expect(validateGuest({ ...good, guest_count: '4' }, { maxGuests: 3 }).guest_count).toContain('up to 3 guests');
    expect(validateGuest({ ...good, expected_arrival_time: '14:00' }, { checkInTime: '15:00' }).expected_arrival_time).toContain('ready from 15:00');
    expect(validateGuest({ ...good, expected_arrival_time: '3.30pm' }).expected_arrival_time).toContain('HH:MM');
    expect(validateGuest({ ...good, special_requests: 'x'.repeat(1001) }).special_requests).toContain('1,000 characters');
  });
});

describe('the photographs a room type will take', () => {
  const file = (type, bytes) => ({ type, size: bytes });
  const megabyte = 1024 * 1024;

  it('accepts a JPEG, PNG or WebP of at most 5 MB', () => {
    expect(photoProblem(file('image/jpeg', 2 * megabyte), { count: 0 })).toBe(null);
    expect(photoProblem(file('image/png', 5 * megabyte), { count: 3 })).toBe(null);
    expect(photoProblem(file('image/webp', 1024), { count: 9 })).toBe(null);
  });

  it('refuses a file of the wrong type, one over 5 MB, and an eleventh photograph', () => {
    expect(photoProblem(file('application/pdf', 1024), { count: 0 })).toContain('not a JPEG, PNG or WebP');
    expect(photoProblem(file('image/jpeg', 5 * megabyte + 1), { count: 0 })).toContain('larger than 5 MB');
    expect(photoProblem(file('image/jpeg', 1024), { count: 10 })).toContain('at most 10 photographs');
  });
});
