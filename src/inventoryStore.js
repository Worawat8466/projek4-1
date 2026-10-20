export const INVENTORY_STORAGE_KEY = 'tleclinic.inventory.v1';

export const defaultInventory = [
  { id: 'MED-001', name: 'ยาพารา (Paracetamol)', batch: 'PCT-01', expiry: '30/12/2570', received: '1/10/2569', units: 2880, packs: 120, baseUnit: 'เม็ด', packUnit: 'แผง', multiplier: 24, unitCostBase: null, status: 'ปกติ' },
  { id: 'MED-002', name: 'วัคซีนรวมสุนัข 5 โรค', batch: 'VAC-05', expiry: '30/06/2570', received: '1/10/2569', units: 15, packs: 15, baseUnit: 'โดส', packUnit: 'โดส', multiplier: 1, unitCostBase: null, status: 'ปกติ' },
  { id: 'FOD-001', name: 'Royal Canin Golden Retriever 3kg', batch: 'RC-3001', expiry: '30/12/2570', received: '1/10/2569', units: 10, packs: 10, baseUnit: 'ถุง', packUnit: 'ถุง', multiplier: 1, unitCostBase: null, status: 'ปกติ' },
  { id: 'MED-004', name: 'Amoxicillin 250mg', batch: 'AMX-09', expiry: '30/12/2569', received: '9/11/2566', units: 120, packs: 10, baseUnit: 'ซอง', packUnit: 'กล่อง', multiplier: 12, unitCostBase: null, status: 'ปกติ' },
  { id: 'MED-004', name: 'Amoxicillin 250mg', batch: 'AMX-90', expiry: '10/11/2569', received: '10/11/2565', units: 120, packs: 10, baseUnit: 'ซอง', packUnit: 'กล่อง', multiplier: 12, unitCostBase: null, status: 'ใกล้หมดอายุ' },
  { id: 'MED-003', name: 'ยาหยอดตา', batch: 'EYE-12', expiry: '12/05/2570', received: '12/05/2566', units: 8, packs: 1, baseUnit: 'ขวด', packUnit: 'ขวด', multiplier: 1, unitCostBase: null, status: 'สต็อกต่ำ' }
];

export function readInventory() {
  try {
    const stored = window.localStorage.getItem(INVENTORY_STORAGE_KEY);
    if (!stored) return defaultInventory;
    const inventory = JSON.parse(stored);
    return Array.isArray(inventory) ? inventory : defaultInventory;
  } catch {
    return defaultInventory;
  }
}

export function saveInventory(inventory) {
  try {
    window.localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(inventory));
    window.dispatchEvent(new Event('clinic-inventory-updated'));
    return true;
  } catch {
    return false;
  }
}

function parseExpiryDate(value) {
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (isoMatch) return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  const [day, month, year] = String(value).split('/').map(Number);
  if (!day || !month || !year) return null;
  return new Date(year >= 2400 ? year - 543 : year, month - 1, day);
}

export function getLotStatus(item, settings) {
  if (settings.expiryAlerts) {
    const expiryDate = parseExpiryDate(item.expiry);
    if (expiryDate) {
      const today = new Date();
      expiryDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      const daysUntilExpiry = Math.ceil((expiryDate - today) / 86400000);
      if (daysUntilExpiry < 0) return 'หมดอายุ';
      if (daysUntilExpiry <= Number(settings.expiryAlertDays)) return 'ใกล้หมดอายุ';
    }
  }
  if (settings.lowStockAlerts && Number(item.units) < Number(settings.lowStockThreshold)) return 'สต็อกต่ำ';
  return 'ปกติ';
}

export function allocateLotsFefo(inventory, productId, requiredBaseQuantity) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sortedLots = inventory
    .filter((lot) => (lot.productId || lot.id) === productId && Number(lot.units) > 0)
    .filter((lot) => {
      const expiryDate = parseExpiryDate(lot.expiry);
      if (!expiryDate) return true;
      expiryDate.setHours(0, 0, 0, 0);
      return expiryDate >= today;
    })
    .sort((first, second) => {
      return (parseExpiryDate(first.expiry)?.getTime() ?? Number.POSITIVE_INFINITY) -
        (parseExpiryDate(second.expiry)?.getTime() ?? Number.POSITIVE_INFINITY);
    });
  const available = sortedLots.reduce((total, lot) => total + Number(lot.units), 0);
  if (available < requiredBaseQuantity) return { enough: false, available, allocations: [], inventory };

  let remaining = requiredBaseQuantity;
  const allocations = [];
  const unitsByBatch = new Map();
  for (const lot of sortedLots) {
    if (remaining <= 0) break;
    const quantity = Math.min(Number(lot.units), remaining);
    allocations.push({ productId, batch: lot.batch, baseQuantity: quantity, unitCostBase: lot.unitCostBase ?? null });
    unitsByBatch.set(lot.batch, quantity);
    remaining -= quantity;
  }

  const updatedInventory = inventory.map((lot) => {
    const deduction = unitsByBatch.get(lot.batch);
    return (lot.productId || lot.id) === productId && deduction
      ? { ...lot, units: Number(lot.units) - deduction }
      : lot;
  });
  return { enough: true, available, allocations, inventory: updatedInventory };
}