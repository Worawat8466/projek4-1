import { deactivateProduct, updateProduct } from '../../../../src/server/productRepository.js';

export const runtime = 'nodejs';

function errorResponse(error) {
  if (error.code === 'ORACLE_NOT_CONFIGURED') return Response.json({ error: 'database_not_configured' }, { status: 503 });
  if (error.code === 'PRODUCT_UNITS_IN_USE') return Response.json({ error: 'product_units_in_use' }, { status: 409 });
  if (error.errorNum === 1) return Response.json({ error: 'product_code_or_barcode_exists' }, { status: 409 });
  return Response.json({ error: 'database_error' }, { status: 500 });
}

export async function PUT(request, { params }) {
  try {
    const { code } = await params;
    const product = await request.json();
    if (!product.name?.trim() || !product.baseUnit?.trim() || !product.packUnit?.trim() || !Number.isFinite(Number(product.salePrice))) {
      return Response.json({ error: 'invalid_product' }, { status: 400 });
    }
    const updated = await updateProduct(decodeURIComponent(code), product);
    return updated ? Response.json({ product: updated }) : Response.json({ error: 'product_not_found' }, { status: 404 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request, { params }) {
  try {
    const { code } = await params;
    const deleted = await deactivateProduct(decodeURIComponent(code));
    return deleted ? new Response(null, { status: 204 }) : Response.json({ error: 'product_not_found' }, { status: 404 });
  } catch (error) {
    return errorResponse(error);
  }
}
