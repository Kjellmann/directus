-- Configure the asset interface without creating a field in products table
-- This approach uses the interface directly on the products form without a database field

-- First, ensure we don't have any leftover field configurations
DELETE FROM directus_fields WHERE collection = 'products' AND field = 'assets_collection';
DELETE FROM directus_relations WHERE one_collection = 'products' AND one_field = 'assets_collection';

-- Create a presentation-only field that won't be included in SQL queries
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
    conditions,
    required,
    "group",
    validation,
    validation_message
) VALUES (
    'products',
    'product_assets_manager',  -- Different field name to avoid confusion
    'cast-json',  -- This ensures it's not queried from the database
    'asset-collection',
    jsonb_build_object(
        'grouping_strategy', 'collection_attribute',
        'enable_tabs', true,
        'allow_upload', true,
        'show_completeness', true,
        'available_roles', ARRAY['packshot', 'lifestyle', 'detail', 'thumbnail']
    )::jsonb,
    'raw',  -- Simple display
    jsonb_build_object('customCss', false)::jsonb,
    false,
    false,
    999,
    'full',
    NULL,
    'Manage product assets',
    NULL,
    false,
    NULL,
    NULL,
    NULL
);

-- Ensure the product_assets relationships are properly configured
-- Product Assets -> Products
DELETE FROM directus_relations 
WHERE many_collection = 'product_assets' 
AND many_field = 'products_id';

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
) VALUES (
    'product_assets',
    'products_id',
    'products',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    'nullify'
);

-- Product Assets -> Assets
DELETE FROM directus_relations 
WHERE many_collection = 'product_assets' 
AND many_field = 'assets_id';

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
) VALUES (
    'product_assets',
    'assets_id',
    'assets',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    'nullify'
);