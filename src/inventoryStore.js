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

