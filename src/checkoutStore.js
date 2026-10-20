import { INVENTORY_STORAGE_KEY } from './inventoryStore.js';
import { INVENTORY_MOVEMENTS_KEY } from './inventoryMovements.js';
import { readSales, SALES_STORAGE_KEY } from './salesLedger.js';

function restoreStorageValue(key, value) {
  if (value === null) window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, value);
}

export function commitCheckout(sale, inventory, movements) {
  const keys = [SALES_STORAGE_KEY, INVENTORY_STORAGE_KEY, INVENTORY_MOVEMENTS_KEY];
  const previousValues = new Map(keys.map((key) => [key, window.localStorage.getItem(key)]));

  try {
    const sales = readSales();
    const existingMovements = JSON.parse(window.localStorage.getItem(INVENTORY_MOVEMENTS_KEY) || '[]');
    window.localStorage.setItem(SALES_STORAGE_KEY, JSON.stringify([...sales, sale]));
    window.localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(inventory));
    window.localStorage.setItem(INVENTORY_MOVEMENTS_KEY, JSON.stringify([
      ...(Array.isArray(existingMovements) ? existingMovements : []),
      ...movements
    ]));
    window.dispatchEvent(new Event('clinic-inventory-updated'));
    window.dispatchEvent(new Event('clinic-inventory-movement'));
    return true;
  } catch {
    for (const [key, value] of previousValues) {
      try { restoreStorageValue(key, value); } catch { /* Preserve the original write failure. */ }
    }
    return false;
  }
}
