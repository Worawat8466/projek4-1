-- Allow unknown costs to stay NULL instead of being reported as zero profit.
ALTER TABLE products MODIFY (base_cost NULL);
ALTER TABLE inventory_lots MODIFY (unit_cost_base NULL);
ALTER TABLE sale_lot_allocations MODIFY (unit_cost_snapshot NULL);
