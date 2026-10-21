import { createSupplier, listSuppliers } from '../../../src/server/clinicRepository.js';
import { databaseErrorResponse } from '../../../src/server/apiErrors.js';

export const runtime = 'nodejs';

export async function GET() {
  try { return Response.json({ suppliers: await listSuppliers() }); }
  catch (error) { return databaseErrorResponse(error); }
}

export async function POST(request) {
  try {
    const input = await request.json();
    if (!input.name?.trim()) return Response.json({ error: 'invalid_supplier' }, { status: 400 });
    return Response.json({ supplier: await createSupplier(input) }, { status: 201 });
  } catch (error) { return databaseErrorResponse(error); }
}
