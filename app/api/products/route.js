import { createProduct, listProducts } from '../../../src/server/productRepository.js';

export const runtime = 'nodejs';

function errorResponse(error) {
  console.error('[products-api]', error.productStage || '', error.code || 'ORACLE_ERROR', error.errorNum || '', error.stack || error.message);
  if (error.code === 'ORACLE_NOT_CONFIGURED') return Response.json({ error: 'database_not_configured' }, { status: 503 });
  if (error.errorNum === 1) return Response.json({ error: 'product_code_or_barcode_exists' }, { status: 409 });
  return Response.json({ error: 'database_error' }, { status: 500 });
}

export async function GET() {
  try {
    return Response.json({ products: await listProducts() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  try {
    const product = await request.json();
    if (!product.id?.trim() || !product.name?.trim() || !product.baseUnit?.trim() || !product.packUnit?.trim() || !Number.isFinite(Number(product.salePrice))) {
      return Response.json({ error: 'invalid_product' }, { status: 400 });
    }
    return Response.json({ product: await createProduct(product) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
