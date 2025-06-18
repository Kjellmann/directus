-- Delete and recreate the assets_collection field properly

-- 1. Delete existing field configuration
DELETE FROM directus_fields WHERE collection = 'products' AND field = 'assets_collection';

-- 2. Delete existing relationships
DELETE FROM directus_relations WHERE one_collection = 'products' AND one_field = 'assets_collection';

-- 3. Create the field with proper configuration
INSERT INTO directus_fields (
    collection, 
    field, 
    special, 
    interface, 
    options, 
    display, 
    display_options, 
    readonly, 
    hidden, 
    sort, 
    width, 
    "group", 
    translations, 
    note, 
    conditions, 
    required, 
    validation, 
    validation_message
)
VALUES (
    'products',
    'assets_collection',
    'alias,o2m',  -- IMPORTANT: This makes it an alias field, not a real column
    'asset-collection',
    jsonb_build_object(
        'grouping_strategy', 'collection_attribute',
        'enable_tabs', true,
        'allow_upload', true,
        'show_completeness', true,
        'available_roles', ARRAY['packshot', 'lifestyle', 'detail', 'thumbnail']
    ),
    'related-values',
    jsonb_build_object(
        'template', '{{assets_id.label}}'
    ),
    false,
    false,
    999,
    'full',
    NULL,
    NULL,
    'Manage product assets with Akeneo-style interface',
    NULL,
    false,
    NULL,
    NULL
);

-- 4. Create the relationship
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
    'assets_collection',
    NULL,
    NULL,
    'assets_id',
    'sort',
    'nullify'
);