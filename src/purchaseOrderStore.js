import { INVENTORY_STORAGE_KEY } from './inventoryStore.js';
import { INVENTORY_MOVEMENTS_KEY } from './inventoryMovements.js';

export const PURCHASE_ORDERS_STORAGE_KEY = 'tleclinic.purchase-orders.v1';

export const defaultPurchaseOrders = [
  {
    id: 'PO-2026-0089', orderedAt: '2026-10-10', supplier: 'บจก. เพ็ทแคร์ (ประเทศไทย) จำกัด',
    productId: 'MED-004', item: 'Amoxicillin 250mg', quantity: 60, receivedQuantity: 60,
    packUnit: 'กล่อง', multiplier: 12, price: 960, total: 57600, status: 'RECEIVED'
  },
  {
    id: 'PO-2026-0090', orderedAt: '2026-10-12', supplier: 'บริษัท โรยัล คานิน (Royal Canin)',
    productId: 'FOD-001', item: 'Royal Canin Golden Retriever 3kg', quantity: 35, receivedQuantity: 0,
    packUnit: 'ถุง', multiplier: 1, price: 600, total: 21000, status: 'ORDERED'
  }
];

export function readPurchaseOrders() {
  try {
    const stored = window.localStorage.getItem(PURCHASE_ORDERS_STORAGE_KEY);
    if (!stored) return defaultPurchaseOrders;
    const orders = JSON.parse(stored);
    return Array.isArray(orders) ? orders : defaultPurchaseOrders;
  } catch {
    return defaultPurchaseOrders;
  }
}

export function savePurchaseOrders(orders) {
  try {
    window.localStorage.setItem(PURCHASE_ORDERS_STORAGE_KEY, JSON.stringify(orders));
    window.dispatchEvent(new Event('clinic-purchase-orders-updated'));
    return true;
  } catch {
    return false;
  }
}

export function commitPurchaseOrderReceipt(orders, inventory, movement) {
  const keys = [PURCHASE_ORDERS_STORAGE_KEY, INVENTORY_STORAGE_KEY, INVENTORY_MOVEMENTS_KEY];
  const previousValues = new Map(keys.map((key) => [key, window.localStorage.getItem(key)]));
  try {
    const movements = JSON.parse(window.localStorage.getItem(INVENTORY_MOVEMENTS_KEY) || '[]');
    const movementRecord = { ...movement, id: `MOV-${Date.now()}`, createdAt: new Date().toISOString() };
    window.localStorage.setItem(PURCHASE_ORDERS_STORAGE_KEY, JSON.stringify(orders));
    window.localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(inventory));
    window.localStorage.setItem(INVENTORY_MOVEMENTS_KEY, JSON.stringify([
      ...(Array.isArray(movements) ? movements : []),
      movementRecord
    ]));
    window.dispatchEvent(new Event('clinic-purchase-orders-updated'));
    window.dispatchEvent(new Event('clinic-inventory-updated'));
    window.dispatchEvent(new Event('clinic-inventory-movement'));
    return true;
  } catch {
    for (const [key, value] of previousValues) {
      try {
        if (value === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, value);
      } catch {}
    }
    return false;
  }
}
