-- Final fix for assets_collection field

-- 1. First, let's remove the field completely
DELETE FROM directus_relations WHERE one_collection = 'products' AND one_field = 'assets_collection';
DELETE FROM directus_fields WHERE collection = 'products' AND field = 'assets_collection';

-- 2. Create it as a pure O2M field (not alias)
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
    translations, 
    note, 
    required
)
VALUES (
    'products',
    'assets_collection',
    'o2m',  -- Just O2M, not alias
    'asset-collection',
    jsonb_build_object(
        'grouping_strategy', 'collection_attribute',
        'enable_tabs', true,
        'allow_upload', true,
        'show_completeness', true,
        'available_roles', ARRAY['packshot', 'lifestyle', 'detail', 'thumbnail']
    )::jsonb,
    NULL,  -- No display
    NULL,  -- No display options
    false,
    false,
    999,
    'full',
    NULL,
    'Manage product assets',
    false
);

-- 3. Create the O2M relationship
INSERT INTO directus_relations (
    many_collection,
    many_field,
    one_collection,
    one_field,
    junction_field,
    sort_field,
    one_deselect_action
)
VALUES (
    'product_assets',
    'products_id',
    'products',
    'assets_collection',
    'assets_id',
    'sort',
    'nullify'
);