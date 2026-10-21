export const themes = [
  { id: 'clinic-green', name: 'คลินิกเขียว', color: '#16a34a', sidebar: '#14532d' },
  { id: 'clinical-blue', name: 'น้ำเงินคลินิก', color: '#2874a6', sidebar: '#183b58' },
  { id: 'ocean-blue', name: 'ฟ้าน้ำทะเล', color: '#0f9d8a', sidebar: '#0b5b52' },
  { id: 'warm-orange', name: 'ส้มอบอุ่น', color: '#ea580c', sidebar: '#7c2d12' },
  { id: 'burgundy', name: 'แดงเบอร์กันดี', color: '#be123c', sidebar: '#701a32' }
];

export const defaultSettings = {
  clinicName: 'TleClinic',
  phone: '02-555-0100',
  address: '333/10 ตำบลเขา อำเภอเขา จังหวัดบึงกาฬ 38150',
  taxId: '',
  receiptFooter: 'ขอบคุณที่ไว้วางใจ TleClinic',
  receiptPrefix: 'INV-',
  vatRate: 7,
  vatEnabled: false,
  defaultDiscount: 0,
  printFormat: 'ใบเสร็จขนาดเล็ก',
  paymentMethods: { cash: true, promptpay: true },
  lowStockAlerts: true,
  expiryAlerts: true,
  lowStockThreshold: 10,
  expiryAlertDays: 30,
  themeId: 'clinic-green'
};

export function getThemeColor(themeId) {
  return themes.find((theme) => theme.id === themeId)?.color || themes[0].color;
}

export function getThemeSidebar(themeId) {
  return themes.find((theme) => theme.id === themeId)?.sidebar || themes[0].sidebar;
}