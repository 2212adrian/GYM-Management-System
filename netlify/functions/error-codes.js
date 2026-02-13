const ERROR_CODES = Object.freeze({
  AGREE_FAILED: {
    code: '003',
    label: 'AGREE_FAILED',
    meaning: 'User did not agree to the protocol.',
  },
  AUTH_FAILED: {
    code: '101',
    label: 'AUTH_FAILED',
    meaning: 'Incorrect email or password.',
  },
  ACCESS_DENIED: {
    code: '102',
    label: 'ACCESS_DENIED',
    meaning: 'User lacks required privileges for this action.',
  },
  REQUEST_INVALID: {
    code: '400',
    label: 'REQUEST_INVALID',
    meaning: 'Request payload is invalid or incomplete.',
  },
  SECURITY_LOCK: {
    code: '403',
    label: 'SECURITY_LOCK',
    meaning: 'Security lock is active for this request.',
  },
  RESOURCE_MISSING: {
    code: '404',
    label: 'RESOURCE_MISSING',
    meaning: 'Requested record could not be found.',
  },
  METHOD_BLOCKED: {
    code: '405',
    label: 'METHOD_BLOCKED',
    meaning: 'HTTP method is not allowed for this route.',
  },
  STATE_CONFLICT: {
    code: '409',
    label: 'STATE_CONFLICT',
    meaning: 'Request conflicts with current state.',
  },
  RATE_LIMIT: {
    code: '429',
    label: 'RATE_LIMIT',
    meaning: 'Rate limit is active. Please wait and retry.',
  },
  SYSTEM_FAULT: {
    code: '500',
    label: 'SYSTEM_FAULT',
    meaning: 'Unexpected internal server error.',
  },
  LINK_OFFLINE: {
    code: '503',
    label: 'LINK_OFFLINE',
    meaning: 'Dependency or gateway is unavailable.',
  },
  KEY_INVALID: {
    code: '601',
    label: 'KEY_INVALID',
    meaning: 'Provided verification key is invalid.',
  },
  KEY_EXPIRED: {
    code: '602',
    label: 'KEY_EXPIRED',
    meaning: 'Verification key has expired.',
  },
  QL_TOKEN_INVALID: {
    code: '701',
    label: 'QL_TOKEN_INVALID',
    meaning: 'Quick-login QR token is invalid.',
  },
  QL_SESSION_INVALID: {
    code: '702',
    label: 'QL_SESSION_INVALID',
    meaning: 'Quick-login session is invalid or unavailable.',
  },
  QL_DEVICE_MISMATCH: {
    code: '703',
    label: 'QL_DEVICE_MISMATCH',
    meaning: 'Quick-login requester device does not match.',
  },
  STOCK_EMPTY: {
    code: '801',
    label: 'STOCK_EMPTY',
    meaning: 'Requested product is out of stock.',
  },
  STOCK_LIMIT: {
    code: '802',
    label: 'STOCK_LIMIT',
    meaning: 'Requested quantity exceeds available stock.',
  },
  CHRONOLOCK_ACTIVE: {
    code: '811',
    label: 'CHRONOLOCK_ACTIVE',
    meaning: 'Chronolock policy blocked future projection requests.',
  },
  FUTURE_DATE_LOCKED: {
    code: '812',
    label: 'FUTURE_DATE_LOCKED',
    meaning: 'Future date selection is locked by security policy.',
  },
});

const CODE_BY_STATUS = Object.freeze({
  400: 'REQUEST_INVALID',
  401: 'AUTH_FAILED',
  403: 'ACCESS_DENIED',
  404: 'RESOURCE_MISSING',
  405: 'METHOD_BLOCKED',
  409: 'STATE_CONFLICT',
  410: 'KEY_EXPIRED',
  429: 'RATE_LIMIT',
  500: 'SYSTEM_FAULT',
  501: 'SYSTEM_FAULT',
  502: 'LINK_OFFLINE',
  503: 'LINK_OFFLINE',
  504: 'LINK_OFFLINE',
});

function getErrorMetaByKey(key) {
  if (key && ERROR_CODES[key]) return ERROR_CODES[key];
  return ERROR_CODES.SYSTEM_FAULT;
}

function inferErrorKeyByStatus(statusCode) {
  return CODE_BY_STATUS[Number(statusCode)] || 'SYSTEM_FAULT';
}

function extractErrorDetail(payload, meta) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const raw =
    source.error ||
    source.message ||
    source.details ||
    source.reason ||
    meta.meaning;
  return String(raw || meta.meaning).trim() || meta.meaning;
}

function hasErrPrefix(text) {
  return /^\[ERR_[A-Z0-9_]+\]/i.test(String(text || '').trim());
}

function formatErrorText(meta, detail) {
  if (hasErrPrefix(detail)) return String(detail).trim();
  return `[ERR_${meta.code}] ${meta.label}: ${String(detail || meta.meaning).trim()}`;
}

function withErrorCode(statusCode, body, fallbackKey = null) {
  const status = Number(statusCode) || 500;
  if (status < 400) return body;

  let payload;
  if (body && typeof body === 'object') {
    payload = { ...body };
  } else if (typeof body === 'string') {
    payload = { error: body };
  } else {
    payload = {};
  }

  const selectedKey =
    fallbackKey || payload.errorKey || inferErrorKeyByStatus(status);
  const meta = getErrorMetaByKey(selectedKey);
  const detail = extractErrorDetail(payload, meta);

  payload.errorCode = payload.errorCode || meta.code;
  payload.errorLabel = payload.errorLabel || meta.label;
  payload.errorMeaning = payload.errorMeaning || meta.meaning;
  payload.error = formatErrorText(meta, detail);
  delete payload.errorKey;
  return payload;
}

module.exports = {
  ERROR_CODES,
  getErrorMetaByKey,
  inferErrorKeyByStatus,
  withErrorCode,
};
