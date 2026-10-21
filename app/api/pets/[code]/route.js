import { deactivatePet, updatePet } from '../../../../src/server/clinicRepository.js';
import { databaseErrorResponse } from '../../../../src/server/apiErrors.js';

export const runtime = 'nodejs';

export async function PUT(request, { params }) {
  try {
    const { code } = await params;
    const pet = await updatePet(decodeURIComponent(code), await request.json());
    return pet ? Response.json({ pet }) : Response.json({ error: 'pet_not_found' }, { status: 404 });
  } catch (error) { return databaseErrorResponse(error); }
}

export async function DELETE(_request, { params }) {
  try {
    const { code } = await params;
    return await deactivatePet(decodeURIComponent(code))
      ? new Response(null, { status: 204 })
      : Response.json({ error: 'pet_not_found' }, { status: 404 });
  } catch (error) { return databaseErrorResponse(error); }
}
