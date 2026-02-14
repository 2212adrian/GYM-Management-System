const { withErrorCode } = require('./error-codes');

function json(statusCode, body) {
  const payload = withErrorCode(statusCode, body);
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(payload),
  };
}

function normalizeIp(rawIp) {
  let ip = String(rawIp || '')
    .split(',')[0]
    .trim();
  if (!ip) return '';
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') return '127.0.0.1';
  return ip;
}

function getClientIp(event) {
  const h = event.headers || {};
  return normalizeIp(h['x-forwarded-for'] || h['X-Forwarded-For'] || h['x-real-ip'] || '');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true });
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  const secret =
    process.env.RECAPTCHA_SECRET_KEY ||
    process.env.RECAPTCHA_SECRET ||
    '';
  if (!secret) return json(500, { error: 'Missing reCAPTCHA secret key' });

  let body;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const token = String(body.token || '').trim();
  if (!token) return json(400, { error: 'Missing reCAPTCHA token' });

  const ip = getClientIp(event);

  try {
    const form = new URLSearchParams();
    form.set('secret', secret);
    form.set('response', token);
    if (ip) form.set('remoteip', ip);

    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    const data = await res.json().catch(() => ({}));
    if (!data || data.success !== true) {
      return json(403, {
        error: 'reCAPTCHA verification failed',
        details: data && data['error-codes'] ? data['error-codes'] : undefined,
      });
    }

    return json(200, { success: true });
  } catch (err) {
    return json(502, { error: 'reCAPTCHA verification unavailable', details: String(err?.message || err) });
  }
};

