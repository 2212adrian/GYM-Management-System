const { createClient } = require('@supabase/supabase-js');
const { withErrorCode } = require('./error-codes');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_AUTH_KEY =
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || SERVICE_ROLE_KEY;

const SUPERADMIN_EMAIL = 'adrianangeles2212@gmail.com';
const MAX_ADMIN_COUNT = 3;

const FIXED_ADMIN_EMAILS = new Set([SUPERADMIN_EMAIL, 'ktorrazo123@gmail.com']);
const FIXED_STAFF_EMAILS = new Set(['adrianangeles2213@gmail.com']);

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function resolveRoleFromUser(user) {
  const email = normalizeEmail(user?.email);
  if (email && FIXED_ADMIN_EMAILS.has(email)) return 'admin';
  if (email && FIXED_STAFF_EMAILS.has(email)) return 'staff';

  const appRole = String(user?.app_metadata?.role || '')
    .trim()
    .toLowerCase();
  if (appRole === 'admin' || appRole === 'staff') return appRole;
  return null;
}

function isSuperAdminUser(user) {
  return normalizeEmail(user?.email) === SUPERADMIN_EMAIL;
}

function asJson(statusCode, payload = {}) {
  return {
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(withErrorCode(statusCode, payload)),
  };
}

function getBearerToken(event) {
  const authHeader =
    event?.headers?.authorization || event?.headers?.Authorization || '';
  const raw = String(authHeader || '').trim();
  if (!raw.toLowerCase().startsWith('bearer ')) return '';
  return raw.slice(7).trim();
}

function parseBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    if (!body.trim()) return {};
    return JSON.parse(body);
  }
  return body;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function toManagedUser(user) {
  const role = resolveRoleFromUser(user);
  if (!role) return null;

  const email = normalizeEmail(user?.email);
  return {
    id: user?.id || null,
    email,
    role,
    isSuperAdmin: email === SUPERADMIN_EMAIL,
    displayName:
      String(user?.user_metadata?.display_name || user?.user_metadata?.full_name || '').trim() ||
      null,
    createdAt: user?.created_at || null,
    lastSignInAt: user?.last_sign_in_at || null,
    emailConfirmedAt: user?.email_confirmed_at || null,
  };
}

function summarizeAccounts(users) {
  const accounts = (users || [])
    .map((user) => toManagedUser(user))
    .filter(Boolean)
    .sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });

  const currentAdmins = accounts.filter((entry) => entry.role === 'admin').length;
  return { accounts, currentAdmins };
}

async function getAllAuthUsers(supabaseAdmin, maxUsers = 2000) {
  const users = [];
  let page = 1;
  const perPage = 200;

  while (users.length < maxUsers) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) return { users: [], error };

    const chunk = Array.isArray(data?.users) ? data.users : [];
    users.push(...chunk);
    if (chunk.length < perPage) break;
    page += 1;
  }

  return { users: users.slice(0, maxUsers), error: null };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return asJson(200, {});
  if (event.httpMethod !== 'POST') {
    return asJson(405, { error: 'Method not allowed' });
  }

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !SUPABASE_AUTH_KEY) {
      return asJson(500, { error: 'Missing Supabase server env vars' });
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_AUTH_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    let payload = {};
    try {
      payload = parseBody(event.body);
    } catch (_) {
      return asJson(400, {
        error: 'Invalid request body JSON',
        errorKey: 'REQUEST_INVALID',
      });
    }

    const accessToken = getBearerToken(event);
    if (!accessToken) {
      return asJson(401, {
        error: 'Missing bearer authorization token',
        errorKey: 'AUTH_FAILED',
      });
    }

    const userResult = await supabaseAuth.auth.getUser(accessToken);
    if (userResult.error || !userResult.data?.user) {
      return asJson(401, {
        error: userResult.error?.message || 'Invalid or expired session token',
        errorKey: 'AUTH_FAILED',
      });
    }

    const caller = userResult.data.user;
    const callerRole = resolveRoleFromUser(caller);
    const callerIsSuperAdmin = isSuperAdminUser(caller);

    if (callerRole !== 'admin') {
      return asJson(403, {
        error: 'Only admin accounts can access user account controls',
        errorKey: 'ACCESS_DENIED',
      });
    }

    const action = String(payload?.action || 'list')
      .trim()
      .toLowerCase();

    const allUsersResult = await getAllAuthUsers(supabaseAdmin);
    if (allUsersResult.error) {
      return asJson(500, { error: allUsersResult.error.message });
    }

    const allUsers = allUsersResult.users;
    const summary = summarizeAccounts(allUsers);

    if (action === 'list') {
      return asJson(200, {
        accounts: summary.accounts,
        limits: {
          maxAdmins: MAX_ADMIN_COUNT,
          currentAdmins: summary.currentAdmins,
        },
        permissions: {
          canCreateAccounts: callerIsSuperAdmin,
          canManageAccounts: callerIsSuperAdmin,
          superAdminEmail: SUPERADMIN_EMAIL,
        },
      });
    }

    if (!callerIsSuperAdmin && action !== 'list') {
      return asJson(403, {
        error: `Only ${SUPERADMIN_EMAIL} can manage admin/staff accounts`,
        errorKey: 'ACCESS_DENIED',
      });
    }

    if (action === 'create') {
      const email = normalizeEmail(payload?.email);
      const role = String(payload?.role || '')
        .trim()
        .toLowerCase();
      const displayName = String(payload?.displayName || '')
        .trim()
        .slice(0, 80);
      const rawPassword = String(payload?.password || '').trim();
      const password = rawPassword || '12345';

      if (!email || !isValidEmail(email)) {
        return asJson(400, {
          error: 'A valid email is required',
          errorKey: 'REQUEST_INVALID',
        });
      }

      if (role !== 'admin' && role !== 'staff') {
        return asJson(400, {
          error: 'Role must be either admin or staff',
          errorKey: 'REQUEST_INVALID',
        });
      }

      const existingAccount = summary.accounts.find((entry) => entry.email === email);
      if (existingAccount) {
        return asJson(409, {
          error: `Account already exists for ${email}`,
          errorKey: 'STATE_CONFLICT',
        });
      }

      if (role === 'admin' && summary.currentAdmins >= MAX_ADMIN_COUNT) {
        return asJson(409, {
          error: `Admin limit reached (${MAX_ADMIN_COUNT}). Remove one admin before adding another.`,
          errorKey: 'STATE_CONFLICT',
        });
      }

      const userMetadata = {};
      if (displayName) {
        userMetadata.display_name = displayName;
        userMetadata.full_name = displayName;
      }

      const createPayload = {
        email,
        password,
        email_confirm: true,
        app_metadata: { role },
        user_metadata: userMetadata,
      };

      const createResult = await supabaseAdmin.auth.admin.createUser(createPayload);
      if (createResult.error) {
        const statusCode =
          Number.isFinite(Number(createResult.error.status)) &&
          Number(createResult.error.status) >= 400
            ? Number(createResult.error.status)
            : 500;

        return asJson(statusCode, {
          error: createResult.error.message || 'Failed to create account',
        });
      }

      const createdUser = toManagedUser(createResult.data?.user);
      const nextAdminCount =
        role === 'admin' ? summary.currentAdmins + 1 : summary.currentAdmins;

      return asJson(201, {
        message: 'Account created successfully',
        account: createdUser,
        defaults: {
          usedDefaultPassword: !rawPassword,
          defaultPassword: rawPassword ? null : '12345',
        },
        limits: {
          maxAdmins: MAX_ADMIN_COUNT,
          currentAdmins: nextAdminCount,
        },
      });
    }

    if (action === 'update') {
      const userId = String(payload?.userId || '').trim();
      const role = String(payload?.role || '')
        .trim()
        .toLowerCase();
      const displayName = String(payload?.displayName || '')
        .trim()
        .slice(0, 80);
      const newPassword = String(payload?.password || '').trim();

      if (!userId) {
        return asJson(400, {
          error: 'userId is required',
          errorKey: 'REQUEST_INVALID',
        });
      }
      if (role !== 'admin' && role !== 'staff') {
        return asJson(400, {
          error: 'Role must be either admin or staff',
          errorKey: 'REQUEST_INVALID',
        });
      }

      const targetUser = allUsers.find((user) => String(user?.id || '') === userId);
      if (!targetUser) {
        return asJson(404, {
          error: 'Target user not found',
          errorKey: 'RESOURCE_MISSING',
        });
      }

      const targetEmail = normalizeEmail(targetUser.email);
      const targetIsFixed = FIXED_ADMIN_EMAILS.has(targetEmail) || FIXED_STAFF_EMAILS.has(targetEmail);
      if (targetEmail === SUPERADMIN_EMAIL || targetIsFixed) {
        return asJson(403, {
          error: 'Fixed system accounts cannot be edited from this panel',
          errorKey: 'ACCESS_DENIED',
        });
      }

      const currentRole = resolveRoleFromUser(targetUser);
      if (role === 'admin' && currentRole !== 'admin' && summary.currentAdmins >= MAX_ADMIN_COUNT) {
        return asJson(409, {
          error: `Admin limit reached (${MAX_ADMIN_COUNT}). Remove one admin before adding another.`,
          errorKey: 'STATE_CONFLICT',
        });
      }

      const updatePayload = {
        app_metadata: { ...(targetUser.app_metadata || {}), role },
      };
      if (displayName) {
        updatePayload.user_metadata = {
          ...(targetUser.user_metadata || {}),
          display_name: displayName,
          full_name: displayName,
        };
      }
      if (newPassword) updatePayload.password = newPassword;

      const updateResult = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        updatePayload,
      );
      if (updateResult.error) {
        return asJson(500, {
          error: updateResult.error.message || 'Failed to update account',
          errorKey: 'SYSTEM_FAULT',
        });
      }

      const updatedAllUsersResult = await getAllAuthUsers(supabaseAdmin);
      if (updatedAllUsersResult.error) {
        return asJson(500, { error: updatedAllUsersResult.error.message });
      }
      const updatedSummary = summarizeAccounts(updatedAllUsersResult.users);
      const updatedEntry = updatedSummary.accounts.find((entry) => entry.id === userId) || null;

      return asJson(200, {
        message: 'Account updated successfully',
        account: updatedEntry,
        limits: {
          maxAdmins: MAX_ADMIN_COUNT,
          currentAdmins: updatedSummary.currentAdmins,
        },
      });
    }

    if (action === 'delete') {
      const userId = String(payload?.userId || '').trim();
      if (!userId) {
        return asJson(400, {
          error: 'userId is required',
          errorKey: 'REQUEST_INVALID',
        });
      }

      const targetUser = allUsers.find((user) => String(user?.id || '') === userId);
      if (!targetUser) {
        return asJson(404, {
          error: 'Target user not found',
          errorKey: 'RESOURCE_MISSING',
        });
      }

      const targetEmail = normalizeEmail(targetUser.email);
      const targetIsFixed = FIXED_ADMIN_EMAILS.has(targetEmail) || FIXED_STAFF_EMAILS.has(targetEmail);
      if (targetEmail === SUPERADMIN_EMAIL || targetIsFixed) {
        return asJson(403, {
          error: 'Fixed system accounts cannot be deleted',
          errorKey: 'ACCESS_DENIED',
        });
      }

      const deleteResult = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (deleteResult.error) {
        return asJson(500, {
          error: deleteResult.error.message || 'Failed to delete account',
          errorKey: 'SYSTEM_FAULT',
        });
      }

      const remainingUsersResult = await getAllAuthUsers(supabaseAdmin);
      if (remainingUsersResult.error) {
        return asJson(500, { error: remainingUsersResult.error.message });
      }
      const remainingSummary = summarizeAccounts(remainingUsersResult.users);

      return asJson(200, {
        message: 'Account deleted successfully',
        limits: {
          maxAdmins: MAX_ADMIN_COUNT,
          currentAdmins: remainingSummary.currentAdmins,
        },
      });
    }

    return asJson(400, {
      error: 'Unsupported action',
      errorKey: 'REQUEST_INVALID',
    });
  } catch (err) {
    return asJson(500, {
      error: err?.message || 'Unexpected server error',
      errorKey: 'SYSTEM_FAULT',
    });
  }
};
