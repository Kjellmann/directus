-- Create a view that flattens product attributes for grid display
CREATE OR REPLACE VIEW products_with_attributes AS
SELECT 
    p.*,
    -- Extract attribute values as columns
    MAX(CASE WHEN a.code = 'name' THEN JSON_UNQUOTE(JSON_EXTRACT(pa.value, '$.value')) END) as attr_name,
    MAX(CASE WHEN a.code = 'sku' THEN JSON_UNQUOTE(JSON_EXTRACT(pa.value, '$.value')) END) as attr_sku,
    MAX(CASE WHEN a.code = 'price' THEN JSON_UNQUOTE(JSON_EXTRACT(pa.value, '$.value')) END) as attr_price,
    MAX(CASE WHEN a.code = 'color' THEN JSON_UNQUOTE(JSON_EXTRACT(pa.value, '$.value')) END) as attr_color,
    MAX(CASE WHEN a.code = 'width' THEN JSON_UNQUOTE(JSON_EXTRACT(pa.value, '$.value')) END) as attr_width,
    MAX(CASE WHEN a.code = 'length' THEN JSON_UNQUOTE(JSON_EXTRACT(pa.value, '$.value')) END) as attr_length,
    MAX(CASE WHEN a.code = 'collection' THEN JSON_UNQUOTE(JSON_EXTRACT(pa.value, '$.value')) END) as attr_collection,
    MAX(CASE WHEN a.code = 'package_dimensions' THEN JSON_UNQUOTE(JSON_EXTRACT(pa.value, '$.value')) END) as attr_package_dimensions
FROM products p
LEFT JOIN product_attributes pa ON p.id = pa.product_id
LEFT JOIN attributes a ON pa.attribute_id = a.id
WHERE a.usable_in_grid = true OR a.code IS NULL
GROUP BY p.id;

-- Register this view as a collection in Directus
-- This would give you a read-only view with all attributes as real columns