// Creates a Razorpay order for a service booking.
// The booking details are saved in the order's "notes", so every paid booking
// is visible in your Razorpay Dashboard (Transactions → Orders → open an order).
// Needs two environment variables in Netlify: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.
const crypto = require('crypto');

const SERVICES = {
  'canopy-lights': 'Canopy light repair',
  'yard-lights': 'Yard light repair',
  'hoarding-lights': 'Hoarding light repair',
  'false-ceiling': 'Canopy false ceiling repair',
  'electrical-panel': 'Electrical panel work'
};
const SITE_TYPES = ['Fuel Station', 'Industrial Plant', 'Commercial Building', 'Hotel', 'Hospital', 'Govt / PSU', 'Other'];
const PRIORITIES = ['Scheduled', 'Emergency (24×7)'];
const MIN_ADVANCE = 500;       // rupees
const MAX_ADVANCE = 500000;    // rupees

const reply = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body)
});
const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });

  const keyId = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !secret) return reply(500, { error: 'Online payment is not set up yet. Please book on WhatsApp: +91 99057 19715.' });

  let b;
  try { b = JSON.parse(event.body || '{}'); } catch (e) { return reply(400, { error: 'Invalid request.' }); }

  const services = [...new Set(Array.isArray(b.services) ? b.services : [])].filter((s) => SERVICES[s]);
  const name = clean(b.name, 80);
  const phone = clean(b.phone, 20).replace(/\D/g, '').slice(-10);
  const email = clean(b.email, 100);
  const siteType = SITE_TYPES.includes(b.siteType) ? b.siteType : '';
  const priority = PRIORITIES.includes(b.priority) ? b.priority : 'Scheduled';
  const address = clean(b.address, 200);
  const city = clean(b.city, 60);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.date || '')) ? b.date : '';
  const amount = Number(b.amount);

  if (!services.length) return reply(400, { error: 'Choose at least one service.' });
  if (name.length < 2) return reply(400, { error: 'Enter your name.' });
  if (!/^[6-9]\d{9}$/.test(phone)) return reply(400, { error: 'Enter a valid 10-digit mobile number.' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(400, { error: 'Check the email address.' });
  if (!siteType) return reply(400, { error: 'Choose a site type.' });
  if (address.length < 5 || city.length < 2) return reply(400, { error: 'Enter the full site address and city.' });
  if (!Number.isInteger(amount) || amount < MIN_ADVANCE) return reply(400, { error: 'Enter a whole rupee advance of ₹500 or more.' });
  if (amount > MAX_ADVANCE) return reply(400, { error: 'For an advance above ₹5,00,000 please contact us on WhatsApp.' });

  // Booking ID like SSR-261120-4F9A2C (date in India time)
  const ist = new Date(Date.now() + 330 * 60000).toISOString();
  const bookingId = 'SSR-' + ist.slice(2, 10).replace(/-/g, '') + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();

  // Razorpay allows up to 15 notes of max 256 characters each.
  const notes = {
    booking_id: bookingId,
    services: services.map((s) => SERVICES[s]).join(', '),
    priority,
    customer_name: name,
    mobile: '+91 ' + phone,
    email: email || '-',
    site_type: siteType,
    site_name: clean(b.siteName, 100) || '-',
    address: clean(address + ', ' + city, 250),
    preferred_date: priority === 'Scheduled' && date ? date : '-',
    problem: clean(b.details, 250) || '-'
  };

  try {
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(keyId + ':' + secret).toString('base64')
      },
      body: JSON.stringify({ amount: amount * 100, currency: 'INR', receipt: bookingId, notes })
    });
    const order = await res.json().catch(() => ({}));
    if (!res.ok || !order.id) {
      console.error('Razorpay order error', res.status, order && order.error);
      return reply(502, { error: 'Could not start the payment. Please try again in a minute.' });
    }
    return reply(200, { keyId, orderId: order.id, amount: order.amount, currency: order.currency, bookingId });
  } catch (e) {
    console.error('Razorpay request failed', e);
    return reply(502, { error: 'Could not reach the payment gateway. Please try again.' });
  }
};
