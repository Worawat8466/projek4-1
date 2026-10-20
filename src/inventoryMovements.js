export const INVENTORY_MOVEMENTS_KEY = 'tleclinic.inventory-movements.v1';

export function readInventoryMovements() {
  try {
    const stored = window.localStorage.getItem(INVENTORY_MOVEMENTS_KEY);
    const movements = stored ? JSON.parse(stored) : [];
    return Array.isArray(movements) ? movements : [];
  } catch {
    return [];
  }
}

export function recordInventoryMovement(movement) {
  try {
    const current = readInventoryMovements();
    window.localStorage.setItem(INVENTORY_MOVEMENTS_KEY, JSON.stringify([
      ...current,
      { ...movement, id: `MOV-${Date.now()}`, createdAt: new Date().toISOString() }
    ]));
    window.dispatchEvent(new Event('clinic-inventory-movement'));
    return true;
  } catch {
    return false;
  }
}

export function commitInventoryMovement(inventory, movement) {
  const previousInventory = window.localStorage.getItem('tleclinic.inventory.v1');
  const previousMovements = window.localStorage.getItem(INVENTORY_MOVEMENTS_KEY);
  try {
    const movements = readInventoryMovements();
    const movementRecord = { ...movement, id: `MOV-${Date.now()}`, createdAt: new Date().toISOString() };
    window.localStorage.setItem('tleclinic.inventory.v1', JSON.stringify(inventory));
    window.localStorage.setItem(INVENTORY_MOVEMENTS_KEY, JSON.stringify([...movements, movementRecord]));
    window.dispatchEvent(new Event('clinic-inventory-updated'));
    window.dispatchEvent(new Event('clinic-inventory-movement'));
    return true;
  } catch {
    try {
      if (previousInventory === null) window.localStorage.removeItem('tleclinic.inventory.v1');
      else window.localStorage.setItem('tleclinic.inventory.v1', previousInventory);
      if (previousMovements === null) window.localStorage.removeItem(INVENTORY_MOVEMENTS_KEY);
      else window.localStorage.setItem(INVENTORY_MOVEMENTS_KEY, previousMovements);
    } catch {}
    return false;
  }
}