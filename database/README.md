# Oracle Database Setup

This project uses Oracle Database 19c or newer with the Node.js driver in Thin mode. No Oracle Instant Client is required for the current connection setup.

## Configure

1. Create an Oracle schema/user for the application and grant the required table, sequence, and session privileges.
2. Run `database/schema.sql` once while connected as that application schema.
3. Run `database/seed.sql` once to add the starter role definitions and default clinic settings.
4. Copy `.env.example` to `.env.local` and set `ORACLE_USER`, `ORACLE_PASSWORD`, and `ORACLE_CONNECT_STRING` for your own environment. Keep `.env.local` private; it is ignored by git.
5. Start the app with `npm run dev` and request `/api/db/health`. A configured, reachable database returns `{ "ok": true, "database": "oracle" }`.

For Oracle XE or a local container, the connect string commonly looks like `localhost:1521/FREEPDB1`. Use the service name provided by your Oracle installation.

## Data Model

- D1: `customers`, `pets`
- D2: `product_categories`, `products`, `product_units`
- D3: `inventory_lots`, `inventory_movements`
- D4: `suppliers`, `purchase_orders`, `purchase_order_items`
- D5: `sales`, `sale_items`, `sale_lot_allocations`, `sale_payments`
- D6: `staff_roles`, `staff`, `clinic_settings`, `audit_logs`

The schema is the first persistence layer. Business API routes should use Oracle transactions when receiving a PO or completing a sale so the document and inventory changes commit or roll back together.
