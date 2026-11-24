// Confirms a booking only after checking that the payment is genuine (Cloudflare Pages Function).
// 1) Checks Razorpay's signature using your secret key (cannot be faked from the browser).
// 2) Reads the payment from Razorpay and makes sure it belongs to this order.
// 3) Captures the payment if it is only "authorized", so the money is actually collected.
import { json, basicAuth, hmacSha256Hex, safeEqual } from '../_shared.js';

export async function onRequestPost({ request, env }) {
  const keyId = env.RAZORPAY_KEY_ID;
  const secret = env.RAZORPAY_KEY_SECRET;
  if (!keyId || !secret) return json(500, { ok: false, error: 'Payment is not set up.' });

  let b;
  try { b = await request.json(); } catch (e) { return json(400, { ok: false, error: 'Invalid request.' }); }
  b = b || {};
  const orderId = String(b.razorpay_order_id || '');
  const paymentId = String(b.razorpay_payment_id || '');
  const signature = String(b.razorpay_signature || '');
  if (!/^order_\w+$/.test(orderId) || !/^pay_\w+$/.test(paymentId) || !/^[a-f0-9]{64}$/.test(signature)) {
    return json(400, { ok: false, error: 'Payment details are incomplete.' });
  }

  const expected = await hmacSha256Hex(secret, orderId + '|' + paymentId);
  if (!safeEqual(expected, signature)) return json(400, { ok: false, error: 'Payment could not be verified.' });

  const auth = basicAuth(keyId, secret);
  const api = (path, opts = {}) =>
    fetch('https://api.razorpay.com/v1' + path, { ...opts, headers: { Authorization: auth, 'Content-Type': 'application/json' } })
      .then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) }));

  try {
    let { ok, data: payment } = await api('/payments/' + paymentId);
    if (!ok || payment.order_id !== orderId) return json(400, { ok: false, error: 'Payment does not match this booking.' });

    if (payment.status === 'authorized') {
      const cap = await api('/payments/' + paymentId + '/capture', {
        method: 'POST',
        body: JSON.stringify({ amount: payment.amount, currency: payment.currency })
      });
      if (cap.ok) payment = cap.data;
    }
    if (!['captured', 'authorized'].includes(payment.status)) {
      return json(400, { ok: false, error: 'Payment is ' + payment.status + '.' });
    }

    const order = await api('/orders/' + orderId);
    const notes = (order.ok && order.data.notes) || payment.notes || {};
    return json(200, {
      ok: true,
      bookingId: notes.booking_id || (order.data && order.data.receipt) || '',
      paymentId,
      amount: payment.amount,
      status: payment.status
    });
  } catch (e) {
    console.error('Verify failed', e);
    return json(502, { ok: false, error: 'Could not confirm the payment right now.' });
  }
}

export const onRequest = () => json(405, { ok: false, error: 'Method not allowed' });
