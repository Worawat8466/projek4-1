-- Run once after schema.sql.
INSERT INTO staff_roles (role_code, role_name, permissions_json, is_system)
VALUES ('ADMIN', 'ผู้ดูแลระบบ', '{"all":true}', 'Y');

INSERT INTO staff_roles (role_code, role_name, permissions_json, is_system)
VALUES ('VET', 'สัตวแพทย์', '{"sales":true,"customers":true,"pets":true}', 'Y');

INSERT INTO staff_roles (role_code, role_name, permissions_json, is_system)
VALUES ('ASSISTANT', 'ผู้ช่วย', '{"sales":true,"customers":true,"pets":true}', 'Y');

INSERT INTO staff_roles (role_code, role_name, permissions_json, is_system)
VALUES ('CASHIER', 'พนักงานหน้าร้าน', '{"sales":true,"customers":true}', 'Y');

INSERT INTO clinic_settings (settings_id, settings_json)
VALUES (1, '{"clinicName":"TleClinic","receiptPrefix":"INV-","vatRate":7,"vatEnabled":false,"defaultDiscount":0,"paymentMethods":{"cash":true,"promptpay":true},"lowStockAlerts":true,"expiryAlerts":true,"lowStockThreshold":10,"expiryAlertDays":30,"themeId":"clinic-green"}');

COMMIT;
