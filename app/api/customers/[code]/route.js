import { deactivateCustomer, updateCustomer } from '../../../../src/server/clinicRepository.js';
import { databaseErrorResponse } from '../../../../src/server/apiErrors.js';

export const runtime = 'nodejs';

export async function PUT(request, { params }) {
  try {
    const { code } = await params;
    const customer = await updateCustomer(decodeURIComponent(code), await request.json());
    return customer ? Response.json({ customer }) : Response.json({ error: 'customer_not_found' }, { status: 404 });
  } catch (error) { return databaseErrorResponse(error); }
}

export async function DELETE(_request, { params }) {
  try {
    const { code } = await params;
    return await deactivateCustomer(decodeURIComponent(code))
      ? new Response(null, { status: 204 })
      : Response.json({ error: 'customer_not_found' }, { status: 404 });
  } catch (error) { return databaseErrorResponse(error); }
}
