UPDATE staff_roles
   SET permissions_json = '{"sales":true,"customers":true,"pets":true,"inventory":true,"dashboard":true,"reports":true}'
 WHERE role_code = 'VET';

UPDATE staff_roles
   SET permissions_json = '{"sales":true,"customers":true,"pets":true,"inventory":true}'
 WHERE role_code = 'ASSISTANT';

UPDATE staff_roles
   SET permissions_json = '{"sales":true,"customers":true,"pets":true}'
 WHERE role_code = 'CASHIER';