ALTER TABLE purchase_order_items ADD (
  unit_name_snapshot VARCHAR2(40),
  base_units_per_unit_snapshot NUMBER(14, 4)
);

UPDATE purchase_order_items poi
   SET unit_name_snapshot = (SELECT pu.unit_name FROM product_units pu WHERE pu.unit_id = poi.unit_id),
       base_units_per_unit_snapshot = (SELECT pu.base_units_per_unit FROM product_units pu WHERE pu.unit_id = poi.unit_id);

ALTER TABLE purchase_order_items MODIFY (
  unit_name_snapshot NOT NULL,
  base_units_per_unit_snapshot NOT NULL
);