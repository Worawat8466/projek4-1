import oracledb from 'oracledb';
import sharp from 'sharp';
import { withOracleConnection, withOracleTransaction } from './oraclePool.js';

export const maxProfileImageBytes = 5 * 1024 * 1024;

const ownerTables = {
  customers: { table: 'customers', key: 'customer_code', ownerColumn: 'customer_id' },
  pets: { table: 'pets', key: 'NVL(chip_number, TO_CHAR(pet_id))', ownerColumn: 'pet_id' },
  staff: { table: 'staff', key: 'staff_id', ownerColumn: 'staff_id' }
};

function getOwnerConfig(entity) {
  const config = ownerTables[entity];
  if (!config) throw Object.assign(new Error('invalid_image_owner'), { code: 'INVALID_IMAGE_OWNER' });
  return config;
}

function detectImageType(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'image/jpeg';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  throw Object.assign(new Error('unsupported_image_type'), { code: 'UNSUPPORTED_IMAGE_TYPE' });
}

async function findOwnerId(connection, entity, identifier) {
  const config = getOwnerConfig(entity);
  const keyValue = entity === 'staff' ? Number(identifier) : identifier;
  if (entity === 'staff' && !Number.isSafeInteger(keyValue)) {
    throw Object.assign(new Error('profile_not_found'), { code: 'PROFILE_NOT_FOUND' });
  }
  const result = await connection.execute(
    `SELECT ${config.ownerColumn} AS owner_id FROM ${config.table}
      WHERE ${config.key} = :key AND is_active = 'Y'`,
    { key: keyValue },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );
  if (!result.rows[0]) throw Object.assign(new Error('profile_not_found'), { code: 'PROFILE_NOT_FOUND' });
  return { ...config, ownerId: result.rows[0].OWNER_ID };
}

export async function saveProfileImage(entity, identifier, fileName, buffer) {
  if (!buffer.length) throw Object.assign(new Error('empty_image'), { code: 'INVALID_IMAGE' });
  if (buffer.length > maxProfileImageBytes) throw Object.assign(new Error('image_too_large'), { code: 'IMAGE_TOO_LARGE' });
  detectImageType(buffer);
  let imageData;
  try {
    imageData = await sharp(buffer, { limitInputPixels: 20_000_000 })
      .rotate()
      .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw Object.assign(new Error('invalid_image_data'), { code: 'INVALID_IMAGE' });
  }
  const mimeType = 'image/webp';
  const nameWithoutExtension = String(fileName || 'profile-image').replace(/\.[^.]+$/, '');
  const safeFileName = `${nameWithoutExtension.replace(/[^\w.-]/g, '_').slice(0, 250) || 'profile-image'}.webp`;

  return withOracleTransaction(async (connection) => {
    const owner = await findOwnerId(connection, entity, identifier);
    const existing = await connection.execute(
      `UPDATE profile_images
          SET mime_type = :mimeType, file_name = :fileName, file_size = :fileSize,
                    image_data = :imageData, updated_at = SYSTIMESTAMP
        WHERE ${owner.ownerColumn} = :ownerId`,
                  { mimeType, fileName: safeFileName, fileSize: imageData.length, imageData, ownerId: owner.ownerId }
    );
    if (!existing.rowsAffected) {
      await connection.execute(
        `INSERT INTO profile_images (${owner.ownerColumn}, mime_type, file_name, file_size, image_data)
         VALUES (:ownerId, :mimeType, :fileName, :fileSize, :imageData)`,
        { ownerId: owner.ownerId, mimeType, fileName: safeFileName, fileSize: imageData.length, imageData }
      );
    }
    return { mimeType, fileName: safeFileName, fileSize: imageData.length };
  });
}

function readLob(lob) {
  if (Buffer.isBuffer(lob)) return Promise.resolve(lob);
  return new Promise((resolve, reject) => {
    const chunks = [];
    lob.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    lob.on('end', () => resolve(Buffer.concat(chunks)));
    lob.on('error', reject);
  });
}

export async function getProfileImage(entity, identifier) {
  return withOracleConnection(async (connection) => {
    const owner = await findOwnerId(connection, entity, identifier);
    const result = await connection.execute(
      `SELECT mime_type, file_name, file_size, image_data FROM profile_images
        WHERE ${owner.ownerColumn} = :ownerId`,
      { ownerId: owner.ownerId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (!result.rows[0]) throw Object.assign(new Error('profile_image_not_found'), { code: 'PROFILE_IMAGE_NOT_FOUND' });
    const row = result.rows[0];
    return { mimeType: row.MIME_TYPE, fileName: row.FILE_NAME, buffer: await readLob(row.IMAGE_DATA) };
  });
}

export async function deleteProfileImage(entity, identifier) {
  return withOracleTransaction(async (connection) => {
    const owner = await findOwnerId(connection, entity, identifier);
    const result = await connection.execute(
      `DELETE FROM profile_images WHERE ${owner.ownerColumn} = :ownerId`,
      { ownerId: owner.ownerId }
    );
    return result.rowsAffected > 0;
  });
}