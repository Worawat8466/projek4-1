import { createSale, listSales } from '../../../src/server/salesRepository.js';
import { databaseErrorResponse } from '../../../src/server/apiErrors.js';

export const runtime = 'nodejs';

export async function GET(request) {
  try {
    const customerCode = new URL(request.url).searchParams.get('customerCode');
    return Response.json({ sales: await listSales(customerCode || null) });
  }
  catch (error) { return databaseErrorResponse(error); }
}

export async function POST(request) {
  try {
    const input = await request.json();
    if (!Array.isArray(input.items) || input.items.length === 0 || !input.paymentMethod) {
      return Response.json({ error: 'invalid_sale' }, { status: 400 });
    }
    return Response.json({ sale: await createSale(input) }, { status: 201 });
  } catch (error) { return databaseErrorResponse(error); }
}