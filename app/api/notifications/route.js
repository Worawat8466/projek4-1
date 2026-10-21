import { getSessionStaffId } from '../../../src/server/authRepository.js';
import { listNotifications, markNotificationsRead, syncNotifications } from '../../../src/server/notificationRepository.js';
import { databaseErrorResponse } from '../../../src/server/apiErrors.js';

export const runtime = 'nodejs';

async function getReaderKey(request) {
  const cookie = request.headers.get('cookie') || '';
  const token = cookie.match(/(?:^|;\s*)tleclinic_session=([^;]+)/)?.[1];
  if (token) {
    const staffId = await getSessionStaffId(token);
    if (staffId) return `STAFF:${staffId}`;
  }
  return process.env.NODE_ENV === 'production' ? null : 'DEV_SHARED';
}

export async function GET(request) {
  try {
    const readerKey = await getReaderKey(request);
    if (!readerKey) return Response.json({ error: 'unauthorized' }, { status: 401 });
    return Response.json(await listNotifications(readerKey));
  } catch (error) { return databaseErrorResponse(error); }
}

export async function POST(request) {
  try {
    const readerKey = await getReaderKey(request);
    if (!readerKey) return Response.json({ error: 'unauthorized' }, { status: 401 });
    return Response.json(await syncNotifications());
  } catch (error) { return databaseErrorResponse(error); }
}

export async function PATCH(request) {
  try {
    const readerKey = await getReaderKey(request);
    if (!readerKey) return Response.json({ error: 'unauthorized' }, { status: 401 });
    const input = await request.json();
    if (input.all !== true && (!Number.isSafeInteger(Number(input.notificationId)) || Number(input.notificationId) < 1)) {
      return Response.json({ error: 'invalid_notification' }, { status: 400 });
    }
    await markNotificationsRead(readerKey, input.all === true ? null : Number(input.notificationId));
    return Response.json({ ok: true });
  } catch (error) { return databaseErrorResponse(error); }
}