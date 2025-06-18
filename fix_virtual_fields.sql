-- Update the special field for attr_ fields to ensure they're recognized properly
UPDATE directus_fields 
SET 
    special = 'alias,no-data',
    "group" = NULL,
    conditions = NULL,
    readonly = false,
    hidden = false
WHERE 
    collection = 'products' 
    AND field LIKE 'attr_%';

-- Ensure the fields have proper display settings
UPDATE directus_fields 
SET 
    display = 'raw',
    display_options = '{}'
WHERE 
    collection = 'products' 
    AND field LIKE 'attr_%'
    AND display IS NULL;

-- Update specific field types for better UI integration
UPDATE directus_fields 
SET 
    interface = 'input',
    display = 'raw'
WHERE 
    collection = 'products' 
    AND field IN ('attr_name', 'attr_sku', 'attr_test', 'attr_width', 'attr_length', 'attr_price');

UPDATE directus_fields 
SET 
    interface = 'input-rich-text',
    display = 'formatted-value'
WHERE 
    collection = 'products' 
    AND field = 'attr_package_dimensions';

UPDATE directus_fields 
SET 
    interface = 'select-dropdown',
    display = 'labels'
WHERE 
    collection = 'products' 
    AND field = 'attr_collection';

-- List all attr_ fields to verify
SELECT 
    field,
    interface,
    display,
    special,
    hidden,
    sort
FROM directus_fields 
WHERE 
    collection = 'products' 
    AND field LIKE 'attr_%'
ORDER BY sort;