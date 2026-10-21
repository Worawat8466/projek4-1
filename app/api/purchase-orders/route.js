import { createPurchaseOrder, listPurchaseOrders } from '../../../src/server/purchaseOrderRepository.js';
import { databaseErrorResponse } from '../../../src/server/apiErrors.js';

export const runtime = 'nodejs';

export async function GET() {
  try { return Response.json({ orders: await listPurchaseOrders() }); }
  catch (error) { return databaseErrorResponse(error); }
}

export async function POST(request) {
  try {
    const input = await request.json();
    if (!input.supplierCode || !input.productCode || !input.packUnit || !Number.isFinite(Number(input.quantity)) || !Number.isFinite(Number(input.packPrice))) {
      return Response.json({ error: 'invalid_order' }, { status: 400 });
    }
    return Response.json({ order: await createPurchaseOrder(input) }, { status: 201 });
  } catch (error) { return databaseErrorResponse(error); }
}
