import {
  deleteProfileImage,
  getProfileImage,
  maxProfileImageBytes,
  saveProfileImage
} from '../../../../../src/server/profileImageRepository.js';

export const runtime = 'nodejs';

function imageError(error) {
  const status = {
    ORACLE_NOT_CONFIGURED: 503,
    INVALID_IMAGE_OWNER: 400,
    INVALID_IMAGE: 400,
    UNSUPPORTED_IMAGE_TYPE: 415,
    IMAGE_TOO_LARGE: 413,
    PROFILE_NOT_FOUND: 404,
    PROFILE_IMAGE_NOT_FOUND: 404
  }[error.code] || 500;
  if (status === 500) console.error('[profile-image-api]', error.code || error.errorNum || '', error.message);
  return Response.json({ error: error.code?.toLowerCase() || 'database_error', maxBytes: maxProfileImageBytes }, { status });
}

export async function GET(_request, { params }) {
  try {
    const { entity, id } = await params;
    const image = await getProfileImage(entity, id);
    return new Response(image.buffer, {
      headers: {
        'Content-Type': image.mimeType,
        'Content-Length': String(image.buffer.length),
        'Content-Disposition': 'inline',
        'Cache-Control': 'private, no-store'
      }
    });
  } catch (error) { return imageError(error); }
}

export async function PUT(request, { params }) {
  try {
    const { entity, id } = await params;
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') return Response.json({ error: 'image_required' }, { status: 400 });
    if (file.size > maxProfileImageBytes) return Response.json({ error: 'image_too_large', maxBytes: maxProfileImageBytes }, { status: 413 });
    const result = await saveProfileImage(entity, id, file.name, Buffer.from(await file.arrayBuffer()));
    return Response.json({ image: result }, { status: 201 });
  } catch (error) { return imageError(error); }
}

export async function DELETE(_request, { params }) {
  try {
    const { entity, id } = await params;
    const deleted = await deleteProfileImage(entity, id);
    return new Response(null, { status: deleted ? 204 : 404 });
  } catch (error) { return imageError(error); }
}