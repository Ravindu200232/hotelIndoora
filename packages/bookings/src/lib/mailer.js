/**
 * The emails this service sends: the booking confirmation, a change, a
 * cancellation and the PayPal payment link for a booking staff took.
 *
 * One transactional service delivers them all. A missing key is reported to the
 * person who triggered the send - never a silent success, and never a stand-in
 * that pretends to send.
 */
export class MailError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MailError';
  }
}

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function wrap({ heading, intro, rows, link, linkLabel, hotel }) {
  const list = rows.map(([label, value]) => `<tr><td style="padding:4px 12px 4px 0;color:#4d6b7a">${label}</td><td style="padding:4px 0"><b>${value}</b></td></tr>`).join('');
  return `<!doctype html><html lang="en"><body style="font-family:system-ui,sans-serif;color:#06202e">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <h1 style="font-size:22px;color:#003049">${heading}</h1>
    <p>${intro}</p>
    <table style="border-collapse:collapse;margin:16px 0">${list}</table>
    ${link ? `<p><a href="${link}" style="background:#003049;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none">${linkLabel}</a></p>` : ''}
    <hr style="border:0;border-top:1px solid #d6e9f1">
    <p style="color:#4d6b7a;font-size:14px">${hotel.hotel_name}, ${hotel.address}<br>${hotel.phone_number} · ${hotel.email_address}<br>Check-in from ${hotel.check_in_time} · Check-out by ${hotel.check_out_time}</p>
    <p style="color:#4d6b7a;font-size:14px">${hotel.house_rules}</p>
  </div></body></html>`;
}

export function bookingConfirmedEmail({ hotel, booking, roomType }) {
  return {
    subject: `${hotel.hotel_name}: booking ${booking.booking_reference} confirmed`,
    html: wrap({
      heading: 'Your stay is booked',
      intro: 'Your payment went through and the room is yours — nothing more is due.',
      rows: [
        ['Booking reference', booking.booking_reference],
        ['Room type', roomType?.name ?? ''],
        ['Check-in', new Date(booking.check_in_date).toDateString()],
        ['Check-out', new Date(booking.check_out_date).toDateString()],
        ['Nights', String(booking.nights)],
        ['Guests', String(booking.guest_count)],
        ['Total paid', `€${Number(booking.total_price).toFixed(2)}`],
      ],
      hotel,
    }),
  };
}

export function paymentLinkEmail({ hotel, booking, roomType, url, amount, heading, intro }) {
  const due = Number(amount ?? booking.total_price);
  return {
    subject: `${hotel.hotel_name}: pay €${due.toFixed(2)} for your stay`,
    html: wrap({
      heading: heading ?? 'Pay for your stay',
      intro: intro ?? 'The hotel booked this stay for you. Pay the full amount through PayPal and your booking is confirmed straight away — the room is held for you meanwhile.',
      rows: [
        ['Room type', roomType?.name ?? ''],
        ['Check-in', new Date(booking.check_in_date).toDateString()],
        ['Check-out', new Date(booking.check_out_date).toDateString()],
        ['Nights', String(booking.nights)],
        ['Total', `€${due.toFixed(2)}`],
      ],
      link: url,
      linkLabel: 'Pay with PayPal',
      hotel,
    }),
  };
}

export function bookingChangedEmail({ hotel, booking, roomType, settled }) {
  const line = settled?.direction === 'charge'
    ? settled.pending
      ? `€${Number(settled.amount).toFixed(2)} is being charged through PayPal — approve it there and the change is settled.`
      : `€${Number(settled.amount).toFixed(2)} was charged through PayPal.`
    : settled?.direction === 'refund'
      ? `€${Number(settled.amount).toFixed(2)} was refunded to you through PayPal.`
      : 'Nothing further was due.';
  return {
    subject: `${hotel.hotel_name}: booking ${booking.booking_reference} changed`,
    html: wrap({
      heading: 'Your booking has changed',
      intro: `${line} These are your new stay details.`,
      rows: [
        ['Booking reference', booking.booking_reference],
        ['Room type', roomType?.name ?? ''],
        ['Check-in', new Date(booking.check_in_date).toDateString()],
        ['Check-out', new Date(booking.check_out_date).toDateString()],
        ['Nights', String(booking.nights)],
        ['Total', `€${Number(booking.total_price).toFixed(2)}`],
      ],
      hotel,
    }),
  };
}

export function bookingCancelledEmail({ hotel, booking, refund }) {
  return {
    subject: `${hotel.hotel_name}: booking ${booking.booking_reference} cancelled`,
    html: wrap({
      heading: 'Your booking is cancelled',
      intro: refund
        ? `The whole amount, €${Number(refund).toFixed(2)}, is on its way back to the PayPal account you paid with. No fee is kept back.`
        : 'Your booking is cancelled and nothing further is due.',
      rows: [
        ['Booking reference', booking.booking_reference ?? ''],
        ['Refunded', refund ? `€${Number(refund).toFixed(2)}` : '—'],
        ['Refunded to', booking.guest_email ?? ''],
      ],
      hotel,
    }),
  };
}

export async function sendMail(message, config, { attempts = 3, gapMs = 1500 } = {}) {
  if (!config.mail.apiKey) {
    throw new MailError(`${config.mail.provider} is not connected: EMAIL_API_KEY is not set, so no email can be sent yet.`);
  }
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${config.mail.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${config.mail.hotelName} <${config.mail.from}>`,
          to: [message.to],
          subject: message.subject,
          html: message.html,
        }),
      });
      if (response.ok) return { id: (await response.json().catch(() => ({}))).id ?? '', attempts: attempt };
      lastError = new MailError(`The email service refused the message (${response.status}).`);
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastError = new MailError(`The email service could not be reached: ${error.message}`);
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, gapMs));
  }
  throw lastError ?? new MailError('The email could not be sent.');
}
