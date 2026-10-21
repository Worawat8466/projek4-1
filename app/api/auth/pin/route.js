import { verifyStaffPin } from '../../../../src/server/authRepository.js';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const input = await request.json();
    const token = request.cookies?.get('tleclinic_session')?.value || request.headers.get('cookie')?.match(/(?:^|;\s*)tleclinic_session=([^;]+)/)?.[1];
    const valid = /^\d{4,6}$/.test(input.pin || '') && await verifyStaffPin(token, input.pin);
    return Response.json({ valid });
  } catch {
    return Response.json({ error: 'database_error' }, { status: 503 });
  }
}