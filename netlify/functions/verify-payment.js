// Confirms a booking only after checking that the payment is genuine.
// 1) Checks Razorpay's signature using your secret key (cannot be faked from the browser).
// 2) Reads the payment from Razorpay and makes sure it belongs to this order.
// 3) Captures the payment if it is only "authorized", so the money is actually collected.
const crypto = require('crypto');

const reply = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body)
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, { ok: false, error: 'Method not allowed' });

  const keyId = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !secret) return reply(500, { ok: false, error: 'Payment is not set up.' });

  let b;
  try { b = JSON.parse(event.body || '{}'); } catch (e) { return reply(400, { ok: false, error: 'Invalid request.' }); }
  const orderId = String(b.razorpay_order_id || '');
  const paymentId = String(b.razorpay_payment_id || '');
  const signature = String(b.razorpay_signature || '');
  if (!/^order_\w+$/.test(orderId) || !/^pay_\w+$/.test(paymentId) || !/^[a-f0-9]{64}$/.test(signature)) {
    return reply(400, { ok: false, error: 'Payment details are incomplete.' });
  }

  const expected = crypto.createHmac('sha256', secret).update(orderId + '|' + paymentId).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return reply(400, { ok: false, error: 'Payment could not be verified.' });
  }

  const auth = 'Basic ' + Buffer.from(keyId + ':' + secret).toString('base64');
  const api = (path, opts = {}) =>
    fetch('https://api.razorpay.com/v1' + path, { ...opts, headers: { Authorization: auth, 'Content-Type': 'application/json' } })
      .then(async (r) => ({ ok: r.ok, data: await r.json().catch(() => ({})) }));

  try {
    let { ok, data: payment } = await api('/payments/' + paymentId);
    if (!ok || payment.order_id !== orderId) return reply(400, { ok: false, error: 'Payment does not match this booking.' });

    if (payment.status === 'authorized') {
      const cap = await api('/payments/' + paymentId + '/capture', {
        method: 'POST',
        body: JSON.stringify({ amount: payment.amount, currency: payment.currency })
      });
      if (cap.ok) payment = cap.data;
    }
    if (!['captured', 'authorized'].includes(payment.status)) {
      return reply(400, { ok: false, error: 'Payment is ' + payment.status + '.' });
    }

    const order = await api('/orders/' + orderId);
    const notes = (order.ok && order.data.notes) || payment.notes || {};
    return reply(200, {
      ok: true,
      bookingId: notes.booking_id || (order.data && order.data.receipt) || '',
      paymentId,
      amount: payment.amount,
      status: payment.status
    });
  } catch (e) {
    console.error('Verify failed', e);
    return reply(502, { ok: false, error: 'Could not confirm the payment right now.' });
  }
};
