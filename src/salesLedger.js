export const SALES_STORAGE_KEY = 'tleclinic.sales.v1';

export function readSales() {
  try {
    const storedSales = window.localStorage.getItem(SALES_STORAGE_KEY);
    const sales = storedSales ? JSON.parse(storedSales) : [];
    return Array.isArray(sales) ? sales : [];
  } catch {
    return [];
  }
}

export function appendSale(sale) {
  try {
    const sales = readSales();
    window.localStorage.setItem(SALES_STORAGE_KEY, JSON.stringify([...sales, sale]));
    return true;
  } catch {
    return false;
  }
}