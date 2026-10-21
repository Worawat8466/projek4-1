ALTER TABLE customers ADD (is_active CHAR(1) DEFAULT 'Y' NOT NULL);
ALTER TABLE pets ADD (is_active CHAR(1) DEFAULT 'Y' NOT NULL);
ALTER TABLE customers ADD CONSTRAINT ck_customers_active CHECK (is_active IN ('Y', 'N'));
ALTER TABLE pets ADD CONSTRAINT ck_pets_active CHECK (is_active IN ('Y', 'N'));
