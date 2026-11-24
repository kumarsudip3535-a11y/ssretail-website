// Cloudflare Worker entry for ssretailservices.in
// Static files (HTML, images) are served from the repo root by Workers Static Assets.
// This script only handles what is not a file: the Razorpay API routes and the /png redirect.
// Razorpay keys are Worker *secrets* (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET) — never put them in this repo.
import * as createOrder from './functions/api/create-order.js';
import * as verifyPayment from './functions/api/verify-payment.js';

const routes = {
  '/api/create-order': createOrder,
  '/api/verify-payment': verifyPayment
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    const route = routes[path];
    if (route) {
      return request.method === 'POST' ? route.onRequestPost({ request, env }) : route.onRequest({ request, env });
    }

    // ssretailservices.in/png → PNG Connect web application
    if (path === '/png' || path.startsWith('/png/')) {
      return Response.redirect('https://png-connect-bokaro.netlify.app/', 302);
    }

    return env.ASSETS.fetch(request);
  }
};
