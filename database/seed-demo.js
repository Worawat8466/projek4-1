import nextEnv from '@next/env';
import {
  createCustomer,
  createPet,
  createSupplier,
  listCustomers,
  listPets,
  listSuppliers
} from '../src/server/clinicRepository.js';
import { listInventoryLots } from '../src/server/inventoryRepository.js';
import { createPurchaseOrder, listPurchaseOrders, receivePurchaseOrderLine } from '../src/server/purchaseOrderRepository.js';
import { createProduct, listProducts } from '../src/server/productRepository.js';
import { createSale, listSales } from '../src/server/salesRepository.js';

nextEnv.loadEnvConfig(process.cwd());

const supplierInput = {
  id: 'DEMO-SUP-001',
  name: 'TleClinic Demo Supplier',
  contact: 'Demo Contact',
  phone: '0800000000',
  email: 'demo-supplier@example.test'
};

const productInputs = [
  { id: 'DEMO-MED-001', name: 'Paracetamol 500 mg', category: 'Medicine', type: 'PRODUCT', baseUnit: 'tablet', packUnit: 'box', multiplier: 24, salePrice: 5, costPrice: 1.2, minimumStock: 10 },
  { id: 'DEMO-VAC-001', name: 'Canine 5-way Vaccine', category: 'Vaccine', type: 'PRODUCT', baseUnit: 'dose', packUnit: 'vial', multiplier: 1, salePrice: 350, costPrice: 180, minimumStock: 5 },
  { id: 'DEMO-FOOD-001', name: 'Complete Dog Food 3 kg', category: 'Pet Food', type: 'PRODUCT', baseUnit: 'bag', packUnit: 'case', multiplier: 4, salePrice: 180, costPrice: 110, minimumStock: 4 },
  { id: 'DEMO-AMX-001', name: 'Amoxicillin 250 mg', category: 'Medicine', type: 'PRODUCT', baseUnit: 'capsule', packUnit: 'box', multiplier: 12, salePrice: 8, costPrice: 3, minimumStock: 12 },
  { id: 'DEMO-EYE-001', name: 'Eye Drops 10 ml', category: 'Medicine', type: 'PRODUCT', baseUnit: 'bottle', packUnit: 'bottle', multiplier: 1, salePrice: 120, costPrice: 55, minimumStock: 3 },
  { id: 'DEMO-SRV-001', name: 'Veterinary Consultation', category: 'Service', type: '\u0e1a\u0e23\u0e34\u0e01\u0e32\u0e23', baseUnit: '\u0e04\u0e23\u0e31\u0e49\u0e07', packUnit: '\u0e04\u0e23\u0e31\u0e49\u0e07', multiplier: 1, salePrice: 250, costPrice: null, minimumStock: 0 }
];

const orderInputs = [
  { poNumber: 'DEMO-PO-MED-001', productCode: 'DEMO-MED-001', packUnit: 'box', quantity: 5, packPrice: 28, notes: 'Demo stock for POS and FEFO testing', receipts: [
    { quantity: 2, lotNumber: 'DEMO-LOT-MED-001-A', expiryDate: '2026-12-31' },
    { quantity: 2, lotNumber: 'DEMO-LOT-MED-001-B', expiryDate: '2027-06-30' }
  ] },
  { poNumber: 'DEMO-PO-VAC-001', productCode: 'DEMO-VAC-001', packUnit: 'vial', quantity: 6, packPrice: 180, notes: 'Demo vaccine stock', receipts: [
    { quantity: 6, lotNumber: 'DEMO-LOT-VAC-001-A', expiryDate: '2027-04-30' }
  ] },
  { poNumber: 'DEMO-PO-FOOD-001', productCode: 'DEMO-FOOD-001', packUnit: 'case', quantity: 4, packPrice: 440, notes: 'Demo pet food stock', receipts: [
    { quantity: 4, lotNumber: 'DEMO-LOT-FOOD-001-A', expiryDate: '2027-12-31' }
  ] },
  { poNumber: 'DEMO-PO-AMX-001', productCode: 'DEMO-AMX-001', packUnit: 'box', quantity: 4, packPrice: 36, notes: 'Demo medicine stock with multiple expiry dates', receipts: [
    { quantity: 2, lotNumber: 'DEMO-LOT-AMX-001-A', expiryDate: '2026-11-30' },
    { quantity: 1, lotNumber: 'DEMO-LOT-AMX-001-B', expiryDate: '2027-05-31' }
  ] },
  { poNumber: 'DEMO-PO-EYE-001', productCode: 'DEMO-EYE-001', packUnit: 'bottle', quantity: 8, packPrice: 55, notes: 'Demo eye drops stock', receipts: [
    { quantity: 8, lotNumber: 'DEMO-LOT-EYE-001-A', expiryDate: '2027-08-31' }
  ] }
];

async function ensureById(items, id, create) {
  const existing = items.find((item) => item.id === id);
  return existing || create();
}

async function main() {
  const supplier = await ensureById(await listSuppliers(), supplierInput.id, () => createSupplier(supplierInput));
  const existingProducts = await listProducts();
  const products = new Map();
  for (const input of productInputs) {
    const product = await ensureById(existingProducts, input.id, () => createProduct(input));
    products.set(input.id, product);
  }

  const customerInputs = [
    { id: 'DEMO-CUS-001', firstName: '\u0e2a\u0e21\u0e0a\u0e32\u0e22', lastName: '\u0e17\u0e14\u0e2a\u0e2d\u0e1a', phone: '0810000001', email: 'demo-customer-001@example.test' },
    { id: 'DEMO-CUS-002', firstName: '\u0e2a\u0e38\u0e14\u0e32', lastName: '\u0e17\u0e14\u0e2a\u0e2d\u0e1a', phone: '0810000002', email: 'demo-customer-002@example.test' },
    { id: 'DEMO-CUS-003', firstName: 'Demo Guest', lastName: 'Owner', phone: '0810000003', email: 'demo-customer-003@example.test' }
  ];
  const existingCustomers = await listCustomers();
  const customers = new Map();
  for (const input of customerInputs) {
    const customer = await ensureById(existingCustomers, input.id, () => createCustomer(input));
    customers.set(input.id, customer);
  }

  const petInputs = [
    { id: 'DEMO-PET-001', ownerCode: 'DEMO-CUS-001', name: '\u0e21\u0e30\u0e25\u0e34', species: 'Cat', breed: 'Domestic Shorthair', gender: '\u0e2b\u0e0d\u0e34\u0e07' },
    { id: 'DEMO-PET-002', ownerCode: 'DEMO-CUS-001', name: '\u0e42\u0e01\u0e42\u0e01\u0e49', species: 'Dog', breed: 'Mixed', gender: '\u0e0a\u0e32\u0e22' },
    { id: 'DEMO-PET-003', ownerCode: 'DEMO-CUS-002', name: '\u0e16\u0e38\u0e07\u0e17\u0e2d\u0e07', species: 'Dog', breed: 'Golden Retriever', gender: '\u0e0a\u0e32\u0e22' },
    { id: 'DEMO-PET-004', ownerCode: 'DEMO-CUS-003', name: 'Demo Cat', species: 'Cat', breed: 'Domestic Shorthair', gender: '\u0e2b\u0e0d\u0e34\u0e07' }
  ];
  const existingPets = await listPets();
  const pets = new Map();
  for (const input of petInputs) {
    const existing = existingPets.find((pet) => pet.id === input.id);
    const pet = existing || await createPet(input);
    pets.set(input.id, pet);
  }

  const existingOrders = await listPurchaseOrders();
  const existingLots = await listInventoryLots();
  for (const input of orderInputs) {
    let order = existingOrders.find((item) => item.id === input.poNumber);
    if (!order) {
      order = await createPurchaseOrder({ ...input, supplierCode: supplier.id });
    }
    for (const receipt of input.receipts) {
      const lotExists = existingLots.some((lot) => lot.productId === input.productCode && lot.batch === receipt.lotNumber);
      if (!lotExists) {
        await receivePurchaseOrderLine(order.purchaseOrderId, {
          productCode: input.productCode,
          quantity: receipt.quantity,
          lotNumber: receipt.lotNumber,
          expiryDate: receipt.expiryDate,
          receivedAt: '2026-10-21',
          reason: 'Demo data seed'
        });
      }
    }
  }

  const sales = await listSales();
  const customer = customers.get('DEMO-CUS-001');
  const petOne = pets.get('DEMO-PET-001');
  const petTwo = pets.get('DEMO-PET-002');
  const demoSaleExists = sales.some((sale) => sale.customerCode === customer.id &&
    sale.items.some((item) => item.productCode === 'DEMO-MED-001'));
  if (!demoSaleExists) {
    await createSale({
      customerCode: customer.id,
      paymentMethod: 'CASH',
      items: [
        { productCode: 'DEMO-MED-001', quantity: 2, petId: petOne.petId },
        { productCode: 'DEMO-VAC-001', quantity: 1, petId: petTwo.petId },
        { productCode: 'DEMO-SRV-001', quantity: 1, petId: petOne.petId }
      ]
    });
  }

  console.log(JSON.stringify({
    supplier: supplier.id,
    products: [...products.keys()],
    customers: [...customers.keys()],
    pets: [...pets.keys()],
    purchaseOrders: orderInputs.map((order) => order.poNumber),
    demoSale: demoSaleExists ? 'already_seeded' : 'created'
  }, null, 2));
}

main().catch((error) => {
  console.error(`Demo seed failed: ${error.code || error.errorNum || ''} ${error.message}`);
  process.exitCode = 1;
});