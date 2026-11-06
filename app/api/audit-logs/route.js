import { getSessionIdentity } from '../../../src/server/authRepository.js';
import { getSessionToken } from '../../../src/server/accessControl.js';
import { listAuditLogs } from '../../../src/server/auditRepository.js';
import { databaseErrorResponse } from '../../../src/server/apiErrors.js';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const identity = await getSessionIdentity(getSessionToken(request));
    if (!identity || identity.roleCode !== 'ADMIN') {
      return Response.json({ error: 'forbidden' }, { status: 403 });
    }
    return Response.json({ logs: await listAuditLogs() });
  } catch (error) { return databaseErrorResponse(error); }
}