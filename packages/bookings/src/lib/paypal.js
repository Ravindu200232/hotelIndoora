/**
 * PayPal is the only way this site takes money or refunds it.
 *
 * The integration is the real one - Orders v2 to take the full amount, Payments
 * v2 to refund it, and the notification verification endpoint to prove a
 * webhook really came from PayPal. Sandbox first: PAYPAL_ENV=sandbox talks to
 * api-m.sandbox.paypal.com, and switching to live is a change of one value and
 * the credentials.
 *
 * Missing credentials are a clear error the caller can show, never a crash and
 * never a pretend success.
 */
export class PayPalError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.name = 'PayPalError';
    this.status = status;
  }
}

export const baseUrlFor = (environment) => (environment === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com');

const money = (amount, currency) => Number(amount).toFixed(2);

async function call(config, path, { method = 'GET', body, token, headers = {} } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.paypal.timeoutMs);
  try {
    const response = await fetch(`${baseUrlFor(config.paypal.environment)}${path}`, {
      method,
      headers: {
        ...headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }
    if (!response.ok) {
      const detail = payload?.message ?? payload?.error_description ?? `PayPal answered ${response.status}`;
      throw new PayPalError(`PayPal refused the request: ${detail}`, { status: response.status });
    }
    return payload;
  } catch (error) {
    if (error instanceof PayPalError) throw error;
    throw new PayPalError(error?.name === 'AbortError'
      ? 'PayPal did not answer in time'
      : `PayPal could not be reached: ${error.message}`);
  } finally {
    clearTimeout(timer);
  }
}

/** The access token every call needs. Credentials come from the environment. */
export async function accessToken(config) {
  const { clientId, clientSecret } = config.paypal;
  if (!clientId || !clientSecret) {
    throw new PayPalError('Payments are not connected yet: PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set on the server.');
  }
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const payload = await call(config, '/v1/oauth2/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: undefined,
  });
  return payload.access_token;
}

/** Create the order the guest approves, for the full amount of the booking. */
export async function createOrder(config, { amount, reference, returnUrl, cancelUrl }) {
  const token = await accessToken(config);
  const payload = await call(config, '/v2/checkout/orders', {
    method: 'POST',
    token,
    body: {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: reference,
        custom_id: reference,
        amount: { currency_code: config.paypal.currency, value: money(amount, config.paypal.currency) },
      }],
      application_context: {
        brand_name: config.mail.hotelName,
        user_action: 'PAY_NOW',
        shipping_preference: 'NO_SHIPPING',
        ...(returnUrl ? { return_url: returnUrl } : {}),
        ...(cancelUrl ? { cancel_url: cancelUrl } : {}),
      },
    },
  });
  const approve = (payload.links ?? []).find((link) => link.rel === 'approve')?.href ?? '';
  return { id: payload.id, status: payload.status, approveUrl: approve };
}

/** A link that can be emailed to a guest: the order's own approval address. */
export async function createPaymentLink(config, { amount, reference, returnUrl, cancelUrl }) {
  const order = await createOrder(config, { amount, reference, returnUrl, cancelUrl });
  return { orderId: order.id, url: order.approveUrl };
}

/** Capture the approved payment and read back the transaction we store. */
export async function captureOrder(config, orderId) {
  const token = await accessToken(config);
  const payload = await call(config, `/v2/checkout/orders/${orderId}/capture`, { method: 'POST', token });
  const capture = payload?.purchase_units?.[0]?.payments?.captures?.[0] ?? {};
  return {
    status: payload.status,
    transactionId: capture.id ?? payload.id,
    amount: capture.amount?.value ? Number(capture.amount.value) : null,
    completed: payload.status === 'COMPLETED' && capture.status === 'COMPLETED',
  };
}

/** Refund a capture in full, or the difference a change settles. */
export async function refundCapture(config, { transactionId, amount }) {
  const token = await accessToken(config);
  const payload = await call(config, `/v2/payments/captures/${transactionId}/refund`, {
    method: 'POST',
    token,
    body: amount ? { amount: { currency_code: config.paypal.currency, value: money(amount, config.paypal.currency) } } : {},
  });
  return {
    id: payload.id,
    status: payload.status,
    completed: payload.status === 'COMPLETED',
    amount: payload.amount?.value ? Number(payload.amount.value) : null,
  };
}

/**
 * Read a refund back: PayPal sometimes answers a refund before it has finished,
 * and the account deletion must not erase anything until it has.
 */
export async function getRefund(config, refundId) {
  const token = await accessToken(config);
  const payload = await call(config, `/v2/payments/refunds/${refundId}`, { token });
  return { id: payload.id, status: payload.status, completed: payload.status === 'COMPLETED' };
}

/**
 * Prove a notification really came from PayPal before any booking, payment or
 * refund changes. An unverifiable notification is refused, not trusted.
 */
export async function verifyWebhook(config, { headers, body }) {
  if (!config.paypal.webhookId) {
    throw new PayPalError('PayPal notifications cannot be verified: PAYPAL_WEBHOOK_ID is not set on the server.');
  }
  const token = await accessToken(config);
  const payload = await call(config, '/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    token,
    body: {
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: config.paypal.webhookId,
      webhook_event: body,
    },
  });
  return payload?.verification_status === 'SUCCESS';
}
