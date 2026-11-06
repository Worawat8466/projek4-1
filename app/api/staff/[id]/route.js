import { deactivateStaff, updateStaff } from '../../../../src/server/clinicRepository.js';
import { databaseErrorResponse } from '../../../../src/server/apiErrors.js';

export const runtime = 'nodejs';

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const input = await request.json();
    if ((input.password && input.password.length < 8) || (input.pin && !/^\d{4,6}$/.test(input.pin))) {
      return Response.json({ error: 'invalid_credentials' }, { status: 400 });
    }
    const staff = await updateStaff(id, input);
    return staff ? Response.json({ staff }) : Response.json({ error: 'staff_not_found' }, { status: 404 });
  } catch (error) { return databaseErrorResponse(error); }
}

export async function DELETE(_request, { params }) {
  try {
    const { id } = await params;
    return await deactivateStaff(id)
      ? new Response(null, { status: 204 })
      : Response.json({ error: 'staff_not_found' }, { status: 404 });
  } catch (error) { return databaseErrorResponse(error); }
}
