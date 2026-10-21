export function databaseErrorResponse(error) {
  console.error('[database-api]', error.code || 'ORACLE_ERROR', error.errorNum || '', error.message);
  if (error.code === 'ORACLE_NOT_CONFIGURED') return Response.json({ error: 'database_not_configured' }, { status: 503 });
  if (error.code === 'SETTINGS_NOT_FOUND') return Response.json({ error: 'settings_not_found' }, { status: 503 });
  if (['CUSTOMER_NOT_FOUND', 'ROLE_NOT_FOUND', 'SUPPLIER_NOT_FOUND', 'PRODUCT_NOT_FOUND', 'PURCHASE_ORDER_NOT_FOUND'].includes(error.code)) return Response.json({ error: error.code.toLowerCase() }, { status: 404 });
  if (['SERVICE_NOT_STOCKED', 'LOT_EXPIRY_MISMATCH', 'INSUFFICIENT_STOCK', 'PET_NOT_OWNED', 'PURCHASE_ORDER_CANCELLED', 'PURCHASE_ORDER_LINE_NOT_FOUND', 'INVALID_RECEIPT_QUANTITY'].includes(error.code)) return Response.json({ error: error.code.toLowerCase() }, { status: 409 });
  if (['INVALID_QUANTITY', 'INVALID_EXPIRY_DATE', 'UNIT_NOT_FOUND', 'INVALID_ORDER_LINE', 'LOT_AND_EXPIRY_REQUIRED', 'INVALID_SALE', 'INVALID_PAYMENT_METHOD', 'INVALID_SETTINGS'].includes(error.code)) return Response.json({ error: error.code.toLowerCase() }, { status: 400 });
  if (error.errorNum === 1) return Response.json({ error: 'duplicate_value' }, { status: 409 });
  return Response.json({ error: 'database_error' }, { status: 500 });
}
