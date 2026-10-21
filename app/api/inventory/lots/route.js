import { deductInventoryLot, listInventoryLots, receiveInventoryLot } from '../../../../src/server/inventoryRepository.js';

export const runtime = 'nodejs';

function errorResponse(error) {
  const statusByCode = {
    ORACLE_NOT_CONFIGURED: 503,
    PRODUCT_NOT_FOUND: 404,
    SERVICE_NOT_STOCKED: 409,
    UNIT_NOT_FOUND: 400,
    INVALID_QUANTITY: 400,
    INVALID_EXPIRY_DATE: 400,
    LOT_EXPIRY_MISMATCH: 409
  };
  const status = statusByCode[error.code] || (error.errorNum === 1 ? 409 : 500);
  return Response.json({ error: error.code || 'database_error' }, { status });
}

export async function GET() {
  try {
    return Response.json({ lots: await listInventoryLots() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    const input = await request.json();
    if (!input.productCode || !input.packUnit || !input.lotNumber?.trim() || !input.expiryDate || !Number.isFinite(Number(input.packQuantity))) {
      return Response.json({ error: 'invalid_receipt' }, { status: 400 });
    }
    const lot = await receiveInventoryLot(input);
    return Response.json({ lot }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
