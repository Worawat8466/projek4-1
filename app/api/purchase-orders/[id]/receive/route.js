import { receivePurchaseOrderLine } from '../../../../../src/server/purchaseOrderRepository.js';
import { databaseErrorResponse } from '../../../../../src/server/apiErrors.js';

export const runtime = 'nodejs';

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const input = await request.json();
    if (!input.productCode || !input.quantity || !input.lotNumber?.trim() || !input.expiryDate) {
      return Response.json({ error: 'invalid_receipt' }, { status: 400 });
    }
    return Response.json(await receivePurchaseOrderLine(id, input));
  } catch (error) { return databaseErrorResponse(error); }
}
