const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ERROR_CODES,
  withErrorCode,
  inferErrorKeyByStatus,
} = require('../netlify/functions/error-codes');

test('maps HTTP status to expected error keys', () => {
  assert.equal(inferErrorKeyByStatus(400), 'REQUEST_INVALID');
  assert.equal(inferErrorKeyByStatus(409), 'STATE_CONFLICT');
  assert.equal(inferErrorKeyByStatus(503), 'LINK_OFFLINE');
  assert.equal(inferErrorKeyByStatus(451), 'COUNTRY_BLOCKED');
  assert.equal(inferErrorKeyByStatus(999), 'SYSTEM_FAULT');
});

test('formats error payload with ERR prefix and metadata', () => {
  const payload = withErrorCode(429, {
    errorKey: 'RATE_LIMIT',
    message: 'Cooldown active',
  });

  assert.equal(payload.errorCode, '429');
  assert.equal(payload.errorLabel, 'RATE_LIMIT');
  assert.match(payload.error, /^\[ERR_429\] RATE_LIMIT:/);
});

test('keeps explicit ERR message unchanged', () => {
  const payload = withErrorCode(500, {
    error: '[ERR_500] SYSTEM_FAULT: Existing message',
  });

  assert.equal(payload.error, '[ERR_500] SYSTEM_FAULT: Existing message');
});

test('newly introduced domain codes are registered', () => {
  assert.equal(ERROR_CODES.STOCK_EMPTY.code, '801');
  assert.equal(ERROR_CODES.STOCK_LIMIT.code, '802');
  assert.equal(ERROR_CODES.CHRONOLOCK_ACTIVE.code, '811');
  assert.equal(ERROR_CODES.FUTURE_DATE_LOCKED.code, '812');
  assert.equal(ERROR_CODES.COUNTRY_BLOCKED.code, '451');
});
