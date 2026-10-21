import oracledb from 'oracledb';
import { withOracleConnection, withOracleTransaction } from './oraclePool.js';

function customerFromRow(row) {
  return {
    id: row.CUSTOMER_CODE,
    customerId: Number(row.CUSTOMER_ID),
    name: [row.FIRST_NAME, row.LAST_NAME].filter(Boolean).join(' '),
    phone: row.PHONE || '',
    email: row.EMAIL || '',
    address: row.ADDRESS || '',
    petCount: Number(row.PET_COUNT) || 0,
    photoUrl: Number(row.HAS_PROFILE_IMAGE) > 0 ? `/api/profile-images/customers/${encodeURIComponent(row.CUSTOMER_CODE)}` : null
  };
}

function petFromRow(row) {
  return {
    id: row.CHIP_NUMBER || String(row.PET_ID),
    petId: Number(row.PET_ID),
    name: row.PET_NAME,
    ownerCode: row.CUSTOMER_CODE,
    owner: [row.OWNER_FIRST_NAME, row.OWNER_LAST_NAME].filter(Boolean).join(' '),
    species: row.SPECIES,
    breed: row.BREED || '',
    gender: row.SEX === 'MALE' ? 'ชาย' : row.SEX === 'FEMALE' ? 'หญิง' : 'ไม่ระบุ',
    birth: row.BIRTH_DATE ? new Date(row.BIRTH_DATE).toISOString().slice(0, 10) : '',
    photoUrl: Number(row.HAS_PROFILE_IMAGE) > 0 ? `/api/profile-images/pets/${encodeURIComponent(row.CHIP_NUMBER || row.PET_ID)}` : null
  };
}

function supplierFromRow(row) {
  return {
    id: row.SUPPLIER_CODE,
    name: row.COMPANY_NAME,
    contact: row.CONTACT_NAME || '',
    phone: row.PHONE || '',
    email: row.EMAIL || '',
    active: row.IS_ACTIVE === 'Y'
  };
}

function staffFromRow(row) {
  return {
    id: Number(row.STAFF_ID),
    name: [row.FIRST_NAME, row.LAST_NAME].filter(Boolean).join(' '),
    role: row.ROLE_NAME,
    roleCode: row.ROLE_CODE,
    email: row.EMAIL,
    phone: row.PHONE || '',
    active: row.IS_ACTIVE === 'Y',
    photoUrl: Number(row.HAS_PROFILE_IMAGE) > 0 ? `/api/profile-images/staff/${Number(row.STAFF_ID)}` : null
  };
}

export async function listCustomers() {
  return withOracleConnection(async (connection) => {
    const result = await connection.execute(
            `SELECT c.customer_id, c.customer_code, c.first_name, c.last_name, c.phone, c.email, c.address,
              (SELECT COUNT(*) FROM pets p WHERE p.customer_id = c.customer_id AND p.is_active = 'Y') AS pet_count,
              (SELECT COUNT(*) FROM profile_images pi WHERE pi.customer_id = c.customer_id) AS has_profile_image
         FROM customers c WHERE c.is_active = 'Y' ORDER BY c.first_name, c.last_name`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows.map(customerFromRow);
  });
}

export async function createCustomer(input) {
  return withOracleTransaction(async (connection) => {
    const code = input.id?.trim() || `CUS-${Date.now()}`;
    await connection.execute(
      `INSERT INTO customers (customer_code, first_name, last_name, phone, email, address)
       VALUES (:code, :firstName, :lastName, :phone, :email, :address)`,
      {
        code,
        firstName: input.firstName?.trim() || input.name?.trim() || '',
        lastName: input.lastName?.trim() || '',
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        address: input.address?.trim() || null
      }
    );
    const result = await connection.execute(
            `SELECT c.customer_id, c.customer_code, c.first_name, c.last_name, c.phone, c.email, c.address,
              0 AS pet_count, 0 AS has_profile_image
         FROM customers c WHERE c.customer_code = :code`,
      { code },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return customerFromRow(result.rows[0]);
  });
}

export async function updateCustomer(code, input) {
  return withOracleTransaction(async (connection) => {
    const result = await connection.execute(
      `UPDATE customers SET first_name = :firstName, last_name = :lastName, phone = :phone,
              email = :email, address = :address, updated_at = SYSTIMESTAMP
        WHERE customer_code = :code AND is_active = 'Y'`,
      {
        code,
        firstName: input.firstName?.trim() || input.name?.trim() || '',
        lastName: input.lastName?.trim() || '',
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        address: input.address?.trim() || null
      }
    );
    if (!result.rowsAffected) return null;
    const rows = await connection.execute(
            `SELECT c.customer_id, c.customer_code, c.first_name, c.last_name, c.phone, c.email, c.address,
              (SELECT COUNT(*) FROM pets p WHERE p.customer_id = c.customer_id AND p.is_active = 'Y') AS pet_count,
              (SELECT COUNT(*) FROM profile_images pi WHERE pi.customer_id = c.customer_id) AS has_profile_image
         FROM customers c WHERE c.customer_code = :code`,
      { code },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return customerFromRow(rows.rows[0]);
  });
}

export async function deactivateCustomer(code) {
  return withOracleTransaction(async (connection) => {
    const result = await connection.execute(
      `UPDATE customers SET is_active = 'N', updated_at = SYSTIMESTAMP WHERE customer_code = :code AND is_active = 'Y'`,
      { code }
    );
    return result.rowsAffected > 0;
  });
}

export async function listPets() {
  return withOracleConnection(async (connection) => {
    const result = await connection.execute(
            `SELECT p.pet_id, p.pet_name, p.species, p.breed, p.sex, p.birth_date, p.chip_number,
              (SELECT COUNT(*) FROM profile_images pi WHERE pi.pet_id = p.pet_id) AS has_profile_image,
              c.customer_code, c.first_name AS owner_first_name, c.last_name AS owner_last_name
         FROM pets p JOIN customers c ON c.customer_id = p.customer_id
        WHERE p.is_active = 'Y' AND c.is_active = 'Y'
        ORDER BY p.pet_name`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows.map(petFromRow);
  });
}

export async function createPet(input) {
  return withOracleTransaction(async (connection) => {
    const customer = await connection.execute(
      `SELECT customer_id FROM customers WHERE customer_code = :customerCode AND is_active = 'Y'`,
      { customerCode: input.ownerCode },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (!customer.rows[0]) throw Object.assign(new Error('customer_not_found'), { code: 'CUSTOMER_NOT_FOUND' });
    const sex = input.gender === 'ชาย' ? 'MALE' : input.gender === 'หญิง' ? 'FEMALE' : 'UNKNOWN';
    const birthDate = input.birth ? new Date(`${input.birth}T00:00:00`) : null;
    await connection.execute(
      `INSERT INTO pets (customer_id, pet_name, species, breed, sex, birth_date, chip_number)
       VALUES (:customerId, :petName, :species, :breed, :sex, :birthDate, :chipNumber)`,
      {
        customerId: customer.rows[0].CUSTOMER_ID,
        petName: input.name?.trim() || '',
        species: input.species?.trim() || 'ไม่ระบุ',
        breed: input.breed?.trim() || null,
        sex,
        birthDate,
        chipNumber: input.id?.trim() || null
      }
    );
    const rows = await connection.execute(
            `SELECT p.pet_id, p.pet_name, p.species, p.breed, p.sex, p.birth_date, p.chip_number,
              0 AS has_profile_image,
              c.customer_code, c.first_name AS owner_first_name, c.last_name AS owner_last_name
         FROM pets p JOIN customers c ON c.customer_id = p.customer_id
        WHERE p.chip_number = :chipNumber ORDER BY p.pet_id DESC FETCH FIRST 1 ROW ONLY`,
      { chipNumber: input.id?.trim() || null },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return petFromRow(rows.rows[0]);
  });
}

export async function updatePet(chipNumber, input) {
  return withOracleTransaction(async (connection) => {
    const customer = await connection.execute(
      `SELECT customer_id FROM customers WHERE customer_code = :customerCode AND is_active = 'Y'`,
      { customerCode: input.ownerCode },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (!customer.rows[0]) throw Object.assign(new Error('customer_not_found'), { code: 'CUSTOMER_NOT_FOUND' });
    const sex = input.gender === 'ชาย' ? 'MALE' : input.gender === 'หญิง' ? 'FEMALE' : 'UNKNOWN';
    const result = await connection.execute(
      `UPDATE pets SET customer_id = :customerId, pet_name = :petName, species = :species,
              breed = :breed, sex = :sex, birth_date = :birthDate
        WHERE chip_number = :chipNumber AND is_active = 'Y'`,
      {
        customerId: customer.rows[0].CUSTOMER_ID,
        petName: input.name?.trim() || '',
        species: input.species?.trim() || 'ไม่ระบุ',
        breed: input.breed?.trim() || null,
        sex,
        birthDate: input.birth ? new Date(`${input.birth}T00:00:00`) : null,
        chipNumber
      }
    );
    if (!result.rowsAffected) return null;
    const rows = await connection.execute(
            `SELECT p.pet_id, p.pet_name, p.species, p.breed, p.sex, p.birth_date, p.chip_number,
              (SELECT COUNT(*) FROM profile_images pi WHERE pi.pet_id = p.pet_id) AS has_profile_image,
              c.customer_code, c.first_name AS owner_first_name, c.last_name AS owner_last_name
         FROM pets p JOIN customers c ON c.customer_id = p.customer_id WHERE p.chip_number = :chipNumber`,
      { chipNumber },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return petFromRow(rows.rows[0]);
  });
}

export async function deactivatePet(chipNumber) {
  return withOracleTransaction(async (connection) => {
    const result = await connection.execute(
      `UPDATE pets SET is_active = 'N' WHERE chip_number = :chipNumber AND is_active = 'Y'`,
      { chipNumber }
    );
    return result.rowsAffected > 0;
  });
}

export async function listSuppliers() {
  return withOracleConnection(async (connection) => {
    const result = await connection.execute(
      `SELECT supplier_code, company_name, contact_name, phone, email, is_active
         FROM suppliers ORDER BY is_active DESC, company_name`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows.map(supplierFromRow);
  });
}

export async function createSupplier(input) {
  return withOracleTransaction(async (connection) => {
    const code = input.id?.trim() || `SUP-${Date.now()}`;
    await connection.execute(
      `INSERT INTO suppliers (supplier_code, company_name, contact_name, phone, email)
       VALUES (:code, :companyName, :contactName, :phone, :email)`,
      {
        code,
        companyName: input.name?.trim() || '',
        contactName: input.contact?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null
      }
    );
    const rows = await connection.execute(
      `SELECT supplier_code, company_name, contact_name, phone, email, is_active
         FROM suppliers WHERE supplier_code = :code`,
      { code },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return supplierFromRow(rows.rows[0]);
  });
}

export async function updateSupplier(code, input) {
  return withOracleTransaction(async (connection) => {
    const result = await connection.execute(
      `UPDATE suppliers SET company_name = :companyName, contact_name = :contactName,
              phone = :phone, email = :email, is_active = :isActive, updated_at = SYSTIMESTAMP
        WHERE supplier_code = :code`,
      {
        code,
        companyName: input.name?.trim() || '',
        contactName: input.contact?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        isActive: input.active === false ? 'N' : 'Y'
      }
    );
    if (!result.rowsAffected) return null;
    const rows = await connection.execute(
      `SELECT supplier_code, company_name, contact_name, phone, email, is_active
         FROM suppliers WHERE supplier_code = :code`,
      { code },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return supplierFromRow(rows.rows[0]);
  });
}

export async function deactivateSupplier(code) {
  return withOracleTransaction(async (connection) => {
    const result = await connection.execute(
      `UPDATE suppliers SET is_active = 'N', updated_at = SYSTIMESTAMP
        WHERE supplier_code = :code AND is_active = 'Y'`,
      { code }
    );
    return result.rowsAffected > 0;
  });
}

export async function listStaff() {
  return withOracleConnection(async (connection) => {
    const result = await connection.execute(
            `SELECT s.staff_id, s.first_name, s.last_name, s.email, s.phone, s.is_active,
              (SELECT COUNT(*) FROM profile_images pi WHERE pi.staff_id = s.staff_id) AS has_profile_image,
              r.role_code, r.role_name
         FROM staff s JOIN staff_roles r ON r.role_id = s.role_id
        WHERE s.is_active = 'Y' ORDER BY s.first_name, s.last_name`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return result.rows.map(staffFromRow);
  });
}

export async function createStaff(input) {
  return withOracleTransaction(async (connection) => {
    const roleCodes = { 'ผู้ดูแลระบบ': 'ADMIN', 'สัตวแพทย์': 'VET', 'ผู้ช่วย': 'ASSISTANT', 'พนักงานหน้าร้าน': 'CASHIER' };
    const roleResult = await connection.execute(
      `SELECT role_id FROM staff_roles WHERE role_code = :roleCode AND is_system = 'Y'`,
      { roleCode: input.roleCode || roleCodes[input.role] || input.role },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (!roleResult.rows[0]) throw Object.assign(new Error('role_not_found'), { code: 'ROLE_NOT_FOUND' });
    await connection.execute(
      `INSERT INTO staff (role_id, first_name, last_name, email, phone)
       VALUES (:roleId, :firstName, :lastName, :email, :phone)`,
      {
        roleId: roleResult.rows[0].ROLE_ID,
        firstName: input.firstName?.trim() || '',
        lastName: input.lastName?.trim() || '',
        email: input.email?.trim() || '',
        phone: input.phone?.trim() || null
      }
    );
    const rows = await connection.execute(
      `SELECT s.staff_id, s.first_name, s.last_name, s.email, s.phone, s.is_active, r.role_code, r.role_name,
            (SELECT COUNT(*) FROM profile_images pi WHERE pi.staff_id = s.staff_id) AS has_profile_image
        FROM staff s JOIN staff_roles r ON r.role_id = s.role_id WHERE s.email = :email`,
      { email: input.email?.trim() || '' },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return staffFromRow(rows.rows[0]);
  });
}

export async function updateStaff(staffId, input) {
  return withOracleTransaction(async (connection) => {
    const roleCodes = { 'ผู้ดูแลระบบ': 'ADMIN', 'สัตวแพทย์': 'VET', 'ผู้ช่วย': 'ASSISTANT', 'พนักงานหน้าร้าน': 'CASHIER' };
    const roleResult = await connection.execute(
      `SELECT role_id FROM staff_roles WHERE role_code = :roleCode AND is_system = 'Y'`,
      { roleCode: input.roleCode || roleCodes[input.role] || input.role },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    if (!roleResult.rows[0]) throw Object.assign(new Error('role_not_found'), { code: 'ROLE_NOT_FOUND' });
    const result = await connection.execute(
      `UPDATE staff SET role_id = :roleId, first_name = :firstName, last_name = :lastName,
              email = :email, phone = :phone, is_active = :isActive, updated_at = SYSTIMESTAMP
        WHERE staff_id = :staffId`,
      {
        staffId: Number(staffId), roleId: roleResult.rows[0].ROLE_ID,
        firstName: input.firstName?.trim() || '', lastName: input.lastName?.trim() || '',
        email: input.email?.trim() || '', phone: input.phone?.trim() || null,
        isActive: input.active === false ? 'N' : 'Y'
      }
    );
    if (!result.rowsAffected) return null;
    const rows = await connection.execute(
      `SELECT s.staff_id, s.first_name, s.last_name, s.email, s.phone, s.is_active, r.role_code, r.role_name,
            (SELECT COUNT(*) FROM profile_images pi WHERE pi.staff_id = s.staff_id) AS has_profile_image
        FROM staff s JOIN staff_roles r ON r.role_id = s.role_id WHERE s.staff_id = :staffId`,
      { staffId: Number(staffId) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    return staffFromRow(rows.rows[0]);
  });
}

export async function deactivateStaff(staffId) {
  return withOracleTransaction(async (connection) => {
    const result = await connection.execute(
      `UPDATE staff SET is_active = 'N', updated_at = SYSTIMESTAMP WHERE staff_id = :staffId AND is_active = 'Y'`,
      { staffId: Number(staffId) }
    );
    return result.rowsAffected > 0;
  });
}
