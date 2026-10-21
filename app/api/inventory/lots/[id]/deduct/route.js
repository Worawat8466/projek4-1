import { deductInventoryLot } from '../../../../../../src/server/inventoryRepository.js';

export const runtime = 'nodejs';

function errorResponse(error) {
  const statusByCode = {
    ORACLE_NOT_CONFIGURED: 503,
    LOT_NOT_FOUND: 404,
    INVALID_QUANTITY: 400,
    INSUFFICIENT_STOCK: 409
  };
  return Response.json({ error: error.code || 'database_error' }, { status: statusByCode[error.code] || 500 });
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const input = await request.json();
    if (!Number.isFinite(Number(input.quantity)) || !input.reason || !input.movementType) {
      return Response.json({ error: 'invalid_deduction' }, { status: 400 });
    }
    const lot = await deductInventoryLot(id, input);
    return Response.json({ lot });
  } catch (error) {
    return errorResponse(error);
  }
}
