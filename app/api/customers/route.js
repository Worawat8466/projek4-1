import { createCustomer, listCustomers } from '../../../src/server/clinicRepository.js';
import { databaseErrorResponse } from '../../../src/server/apiErrors.js';

export const runtime = 'nodejs';

export async function GET() {
  try { return Response.json({ customers: await listCustomers() }); }
  catch (error) { return databaseErrorResponse(error); }
}

export async function POST(request) {
  try {
    const input = await request.json();
    if (!(input.firstName || input.name)?.trim()) return Response.json({ error: 'invalid_customer' }, { status: 400 });
    return Response.json({ customer: await createCustomer(input) }, { status: 201 });
  } catch (error) { return databaseErrorResponse(error); }
}
