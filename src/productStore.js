export const PRODUCTS_STORAGE_KEY = 'tleclinic.products.v1';

export const defaultProducts = [
  {
    id: 'MED-001', name: 'ยาพารา (Paracetamol)', category: 'ยา', type: 'สินค้า',
    baseUnit: 'เม็ด', packUnit: 'แผง', multiplier: 24,
    salePrice: 200, costPrice: null, minimumStock: 20, tracksStock: true
  },
  {
    id: 'SRV-001', name: 'ตรวจสุขภาพทั่วไป', category: 'บริการ', type: 'บริการ',
    baseUnit: 'ครั้ง', packUnit: 'ครั้ง', multiplier: 1,
    salePrice: 150, costPrice: null, minimumStock: 0, tracksStock: false
  },
  {
    id: 'MED-002', name: 'วัคซีนรวมสุนัข 5 โรค', category: 'ยา', type: 'สินค้า',
    baseUnit: 'โดส', packUnit: 'โดส', multiplier: 1,
    salePrice: 350, costPrice: null, minimumStock: 5, tracksStock: true
  },
  {
    id: 'SRV-002', name: 'ค่าบริการฉีดวัคซีน/ทำแผล', category: 'บริการ', type: 'บริการ',
    baseUnit: 'ครั้ง', packUnit: 'ครั้ง', multiplier: 1,
    salePrice: 100, costPrice: null, minimumStock: 0, tracksStock: false
  },
  {
    id: 'FOD-001', name: 'Royal Canin Golden Retriever 3kg', category: 'อาหารสัตว์', type: 'สินค้า',
    baseUnit: 'ถุง', packUnit: 'ถุง', multiplier: 1,
    salePrice: 850, costPrice: null, minimumStock: 2, tracksStock: true
  },
  {
    id: 'MED-003', name: 'ยาหยอดตา', category: 'ยา', type: 'สินค้า',
    baseUnit: 'ขวด', packUnit: 'ขวด', multiplier: 1,
    salePrice: 120, costPrice: null, minimumStock: 10, tracksStock: true
  },
  {
    id: 'MED-004', name: 'Amoxicillin 250mg', category: 'ยา', type: 'สินค้า',
    baseUnit: 'ซอง', packUnit: 'กล่อง', multiplier: 12,
    salePrice: 80, costPrice: null, minimumStock: 20, tracksStock: true
  }
];

export function readProducts() {
  try {
    const stored = window.localStorage.getItem(PRODUCTS_STORAGE_KEY);
    if (!stored) return defaultProducts;
    const products = JSON.parse(stored);
    return Array.isArray(products) ? products : defaultProducts;
  } catch {
    return defaultProducts;
  }
}

export function saveProducts(products) {
  try {
    window.localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
    window.dispatchEvent(new Event('clinic-products-updated'));
    return true;
  } catch {
    return false;
  }
}
