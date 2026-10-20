export const INVENTORY_STORAGE_KEY = 'tleclinic.inventory.v1';

export const defaultInventory = [
  { id: 'MED-001', name: 'Amoxicillin 250mg', batch: 'AMX-09', expiry: '9/11/2568', received: '9/11/2566', units: 120, packs: 10, status: 'ปกติ' },
  { id: 'MED-002', name: 'Amoxicillin 250mg', batch: 'AMX-90', expiry: '10/11/2566', received: '10/11/2565', units: 120, packs: 10, status: 'ใกล้หมดอายุ' },
  { id: 'MED-003', name: 'ยาหยอดตา', batch: 'EYE-12', expiry: '12/05/2568', received: '12/05/2566', units: 8, packs: 1, status: 'สต็อกต่ำ' }
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

export function getLotStatus(item, settings) {
  if (settings.expiryAlerts) {
    const [day, month, year] = String(item.expiry).split('/').map(Number);
    if (day && month && year) {
      const expiryDate = new Date(year >= 2400 ? year - 543 : year, month - 1, day);
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