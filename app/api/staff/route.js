import { createStaff, listStaff } from '../../../src/server/clinicRepository.js';
import { databaseErrorResponse } from '../../../src/server/apiErrors.js';
import { getSessionIdentity } from '../../../src/server/authRepository.js';
import { getSessionToken } from '../../../src/server/accessControl.js';

export const runtime = 'nodejs';

export async function GET() {
  try { return Response.json({ staff: await listStaff() }); }
  catch (error) { return databaseErrorResponse(error); }
}

export async function POST(request) {
  try {
    const input = await request.json();
    if (!input.firstName?.trim() || !input.lastName?.trim() || !input.email?.trim() || !(input.roleCode || input.role) ||
      (input.password || '').length < 8 || !/^\d{4,6}$/.test(input.pin || '')) {
      return Response.json({ error: 'invalid_staff' }, { status: 400 });
    }
    const identity = await getSessionIdentity(getSessionToken(request));
    return Response.json({ staff: await createStaff({ ...input, actorId: identity?.staffId || null }) }, { status: 201 });
  } catch (error) { return databaseErrorResponse(error); }
}
