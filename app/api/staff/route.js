import { createStaff, listStaff } from '../../../src/server/clinicRepository.js';
import { databaseErrorResponse } from '../../../src/server/apiErrors.js';

export const runtime = 'nodejs';

export async function GET() {
  try { return Response.json({ staff: await listStaff() }); }
  catch (error) { return databaseErrorResponse(error); }
}

export async function POST(request) {
  try {
    const input = await request.json();
    if (!input.firstName?.trim() || !input.lastName?.trim() || !input.email?.trim() || !(input.roleCode || input.role)) {
      return Response.json({ error: 'invalid_staff' }, { status: 400 });
    }
    return Response.json({ staff: await createStaff(input) }, { status: 201 });
  } catch (error) { return databaseErrorResponse(error); }
}
