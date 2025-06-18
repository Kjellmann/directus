-- Fix the assets_collection field configuration

-- 1. Update the field to be an alias field
UPDATE directus_fields 
SET 
    special = 'alias,o2m',
    interface = 'asset-collection',
    display = 'related-values',
    display_options = jsonb_build_object(
        'template', '{{assets_id.label}}'
    ),
    hidden = false,
    readonly = false,
    required = false,
    options = jsonb_build_object(
        'grouping_strategy', 'collection_attribute',
        'enable_tabs', true,
        'allow_upload', true,
        'show_completeness', true,
        'available_roles', ARRAY['packshot', 'lifestyle', 'detail', 'thumbnail']
    )
WHERE collection = 'products' AND field = 'assets_collection';

-- 2. Create the one-to-many relationship from products to product_assets
DELETE FROM directus_relations 
WHERE one_collection = 'products' AND one_field = 'assets_collection';

INSERT INTO directus_relations (
    many_collection,
    many_field,
    one_collection,
    one_field,
    one_collection_field,
    one_allowed_collections,
    junction_field,
    sort_field,
    one_deselect_action
)
VALUES (
    'product_assets',  -- many_collection
    'products_id',     -- many_field
    'products',        -- one_collection
    'assets_collection', -- one_field (this is the alias field on products)
    NULL,              -- one_collection_field
    NULL,              -- one_allowed_collections
    'assets_id',       -- junction_field
    'sort',            -- sort_field
    'nullify'          -- one_deselect_action
);

-- 3. Ensure the reverse relationship exists
DELETE FROM directus_relations 
WHERE many_collection = 'product_assets' 
AND many_field = 'products_id' 
AND one_collection = 'products'
AND one_field IS NULL;

INSERT INTO directus_relations (
    many_collection,
    many_field,
    one_collection,
    one_field,
    one_collection_field,
    one_allowed_collections,
    junction_field,
    sort_field,
    one_deselect_action
)
VALUES (
    'product_assets',
    'products_id',
    'products',
    NULL,
    NULL,
    NULL,
    'assets_id',
    'sort',
    'nullify'
)
ON CONFLICT DO NOTHING;

-- 4. Ensure the assets relationship exists
DELETE FROM directus_relations 
WHERE many_collection = 'product_assets' 
AND many_field = 'assets_id' 
AND one_collection = 'assets';

INSERT INTO directus_relations (
    many_collection,
    many_field,
    one_collection,
    one_field,
    one_collection_field,
    one_allowed_collections,
    junction_field,
    sort_field,
    one_deselect_action
)
VALUES (
    'product_assets',
    'assets_id',
    'assets',
    NULL,
    NULL,
    NULL,
    'products_id',
    NULL,
    'nullify'
)
ON CONFLICT DO NOTHING;

-- 5. Make sure product_assets fields are properly registered
INSERT INTO directus_fields (collection, field, special, interface, display, display_options, options, hidden, readonly, required, sort, width, "group", translations, note)
VALUES 
    ('product_assets', 'id', 'uuid', 'input', NULL, NULL, NULL, true, true, false, 1, 'full', NULL, NULL, NULL),
    ('product_assets', 'products_id', 'm2o', 'select-dropdown-m2o', NULL, NULL, NULL, true, false, true, 2, 'half', NULL, NULL, NULL),
    ('product_assets', 'assets_id', 'm2o', 'select-dropdown-m2o', 'related-values', '{"template":"{{label}} ({{code}})"}', NULL, false, false, true, 3, 'half', NULL, NULL, NULL),
    ('product_assets', 'collection_type_id', 'm2o', 'select-dropdown-m2o', 'related-values', '{"template":"{{label}}"}', NULL, false, false, false, 4, 'half', NULL, NULL, 'Collection Type'),
    ('product_assets', 'role_id', 'm2o', 'select-dropdown-m2o', 'related-values', '{"template":"{{label}}"}', NULL, false, false, false, 5, 'half', NULL, NULL, 'Asset Role'),
    ('product_assets', 'sort', NULL, 'input', NULL, NULL, '{"min":0}', false, false, false, 6, 'half', NULL, NULL, 'Sort Order'),
    ('product_assets', 'enabled', 'cast-boolean', 'boolean', 'boolean', NULL, NULL, false, false, false, 7, 'half', NULL, NULL, NULL),
    ('product_assets', 'tags', 'cast-json', 'tags', 'labels', NULL, NULL, false, false, false, 8, 'full', NULL, NULL, 'Asset Tags')
ON CONFLICT (collection, field) DO UPDATE
SET 
    special = EXCLUDED.special,
    interface = EXCLUDED.interface,
    display = EXCLUDED.display,
    display_options = EXCLUDED.display_options,
    hidden = EXCLUDED.hidden;

-- 6. Restart Directus cache (this will be done by restarting the container)