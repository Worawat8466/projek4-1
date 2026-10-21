import {
  deleteSession,
  getAuthStatus,
  loginStaff,
  recoverStaffAccount,
  setupAdmin
} from '../../../src/server/authRepository.js';

export const runtime = 'nodejs';

const cookieName = 'tleclinic_session';

function sessionResponse(data, token) {
  return Response.json(data, {
    headers: {
      'Set-Cookie': `${cookieName}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=43200${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
    }
  });
}

function errorResponse(error) {
  const status = {
    ORACLE_NOT_CONFIGURED: 503,
    AUTH_NOT_CONFIGURED: 503,
    SETUP_COMPLETE: 409,
    INVALID_CREDENTIALS: 401,
    INVALID_RECOVERY_CODE: 400
  }[error.code] || 500;
  console.error('[auth-api]', error.code || 'AUTH_ERROR', error.errorNum || '', error.stack || error.message);
  return Response.json({ error: error.code?.toLowerCase() || 'auth_error' }, { status });
}

export async function GET() {
  try { return Response.json(await getAuthStatus()); }
  catch (error) { return errorResponse(error); }
}

export async function POST(request) {
  try {
    const input = await request.json();
    if (input.action === 'setup') {
      if (!/^\S+@\S+\.\S+$/.test(input.email || '') || (input.password || '').length < 8 || !/^\d{4,6}$/.test(input.pin || '')) {
        return Response.json({ error: 'invalid_setup' }, { status: 400 });
      }
      const result = await setupAdmin(input);
      return sessionResponse({ recoveryCode: result.recoveryCode }, result.token);
    }
    if (input.action === 'login') {
      if (!input.email || !input.password) return Response.json({ error: 'invalid_credentials' }, { status: 400 });
      const result = await loginStaff(input);
      return sessionResponse({ ok: true }, result.token);
    }
    if (input.action === 'recover') {
      if (!input.email || !input.recoveryCode || (input.password || '').length < 8 || !/^\d{4,6}$/.test(input.pin || '')) {
        return Response.json({ error: 'invalid_recovery_request' }, { status: 400 });
      }
      await recoverStaffAccount(input);
      return Response.json({ ok: true });
    }
    if (input.action === 'logout') {
      const token = request.cookies?.get(cookieName)?.value || request.headers.get('cookie')?.match(/(?:^|;\s*)tleclinic_session=([^;]+)/)?.[1];
      await deleteSession(token);
      return Response.json({ ok: true }, {
        headers: { 'Set-Cookie': `${cookieName}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}` }
      });
    }
    return Response.json({ error: 'unknown_action' }, { status: 400 });
  } catch (error) { return errorResponse(error); }
}