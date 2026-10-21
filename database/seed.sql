-- Run after schema.sql. Safe to execute more than once.
MERGE INTO staff_roles target
USING (SELECT 'ADMIN' role_code, 'ผู้ดูแลระบบ' role_name, '{"all":true}' permissions_json, 'Y' is_system FROM dual) source
ON (target.role_code = source.role_code)
WHEN NOT MATCHED THEN INSERT (role_code, role_name, permissions_json, is_system)
VALUES (source.role_code, source.role_name, source.permissions_json, source.is_system);

MERGE INTO staff_roles target
USING (SELECT 'VET' role_code, 'สัตวแพทย์' role_name, '{"sales":true,"customers":true,"pets":true}' permissions_json, 'Y' is_system FROM dual) source
ON (target.role_code = source.role_code)
WHEN NOT MATCHED THEN INSERT (role_code, role_name, permissions_json, is_system)
VALUES (source.role_code, source.role_name, source.permissions_json, source.is_system);

MERGE INTO staff_roles target
USING (SELECT 'ASSISTANT' role_code, 'ผู้ช่วย' role_name, '{"sales":true,"customers":true,"pets":true}' permissions_json, 'Y' is_system FROM dual) source
ON (target.role_code = source.role_code)
WHEN NOT MATCHED THEN INSERT (role_code, role_name, permissions_json, is_system)
VALUES (source.role_code, source.role_name, source.permissions_json, source.is_system);

MERGE INTO staff_roles target
USING (SELECT 'CASHIER' role_code, 'พนักงานหน้าร้าน' role_name, '{"sales":true,"customers":true}' permissions_json, 'Y' is_system FROM dual) source
ON (target.role_code = source.role_code)
WHEN NOT MATCHED THEN INSERT (role_code, role_name, permissions_json, is_system)
VALUES (source.role_code, source.role_name, source.permissions_json, source.is_system);

MERGE INTO clinic_settings target
USING (SELECT 1 settings_id FROM dual) source
ON (target.settings_id = source.settings_id)
WHEN NOT MATCHED THEN INSERT (settings_id, settings_json)
VALUES (1, '{"clinicName":"TleClinic","receiptPrefix":"INV-","vatRate":7,"vatEnabled":false,"defaultDiscount":0,"paymentMethods":{"cash":true,"promptpay":true},"lowStockAlerts":true,"expiryAlerts":true,"lowStockThreshold":10,"expiryAlertDays":30,"themeId":"clinic-green"}');

COMMIT;
