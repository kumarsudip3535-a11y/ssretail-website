# SS Retail Services website (ssretailservices.in)

- `index.html` – homepage (3D site tour, Book a Service section, PNG tab)
- `book.html` – 3D booking page with Razorpay advance payment (minimum ₹500)
- `functions/api/create-order.js` – Cloudflare Pages Function: creates the Razorpay order and enforces the ₹500 minimum on the server (`/api/create-order`)
- `functions/api/verify-payment.js` – Cloudflare Pages Function: verifies the payment signature with Razorpay before confirming a booking (`/api/verify-payment`)
- `netlify/`, `netlify.toml` – old Netlify versions, kept only as a backup
- `_redirects` – `/png` → PNG Connect app
- `png/` – PNG Connect files

Hosting: Cloudflare Pages (no build command, output directory `/`).

Cloudflare Pages environment variables required for payments (Settings → Variables and Secrets, type Secret):
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

Paid bookings appear in Razorpay Dashboard → Transactions → Orders, with customer and site details in the order notes.
