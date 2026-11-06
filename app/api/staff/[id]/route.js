import { deactivateStaff, updateStaff } from '../../../../src/server/clinicRepository.js';
import { databaseErrorResponse } from '../../../../src/server/apiErrors.js';
import { getSessionIdentity } from '../../../../src/server/authRepository.js';
import { getSessionToken } from '../../../../src/server/accessControl.js';

export const runtime = 'nodejs';

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const input = await request.json();
    if ((input.password && input.password.length < 8) || (input.pin && !/^\d{4,6}$/.test(input.pin))) {
      return Response.json({ error: 'invalid_credentials' }, { status: 400 });
    }
    const identity = await getSessionIdentity(getSessionToken(request));
    const staff = await updateStaff(id, { ...input, actorId: identity?.staffId || null });
    return staff ? Response.json({ staff }) : Response.json({ error: 'staff_not_found' }, { status: 404 });
  } catch (error) { return databaseErrorResponse(error); }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const identity = await getSessionIdentity(getSessionToken(request));
    return await deactivateStaff(id, identity?.staffId || null)
      ? new Response(null, { status: 204 })
      : Response.json({ error: 'staff_not_found' }, { status: 404 });
  } catch (error) { return databaseErrorResponse(error); }
}
