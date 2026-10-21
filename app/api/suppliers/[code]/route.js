import { deactivateSupplier, updateSupplier } from '../../../../src/server/clinicRepository.js';
import { databaseErrorResponse } from '../../../../src/server/apiErrors.js';

export const runtime = 'nodejs';

export async function PUT(request, { params }) {
  try {
    const { code } = await params;
    const supplier = await updateSupplier(decodeURIComponent(code), await request.json());
    return supplier ? Response.json({ supplier }) : Response.json({ error: 'supplier_not_found' }, { status: 404 });
  } catch (error) { return databaseErrorResponse(error); }
}

export async function DELETE(_request, { params }) {
  try {
    const { code } = await params;
    return await deactivateSupplier(decodeURIComponent(code))
      ? new Response(null, { status: 204 })
      : Response.json({ error: 'supplier_not_found' }, { status: 404 });
  } catch (error) { return databaseErrorResponse(error); }
}
