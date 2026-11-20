# SS Retail Services website (ssretailservices.in)

- `index.html` – homepage (3D site tour, Book a Service section, PNG tab)
- `book.html` – 3D booking page with Razorpay advance payment (minimum ₹500)
- `netlify/functions/create-order.js` – creates the Razorpay order and enforces the ₹500 minimum on the server
- `netlify/functions/verify-payment.js` – verifies the payment signature with Razorpay before confirming a booking
- `netlify.toml` – Netlify settings (functions folder)
- `_redirects` – `/png` → PNG Connect app
- `png/` – PNG Connect files

Netlify environment variables required for payments:
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

Paid bookings appear in Razorpay Dashboard → Transactions → Orders, with customer and site details in the order notes.
