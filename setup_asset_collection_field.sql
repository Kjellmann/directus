-- First, ensure the field is properly registered in Directus
-- This creates an alias field for the asset collection interface

-- Delete any existing field registration
DELETE FROM directus_fields WHERE collection = 'products' AND field = 'assets_collection';

-- Create the alias field configuration
INSERT INTO directus_fields (collection, field, special, interface, options, display, display_options, readonly, hidden, sort, width, "group", translations, note, conditions, required, validation, validation_message)
VALUES (
    'products',
    'assets_collection',
    'alias,o2m',
    'asset-collection',
    jsonb_build_object(
        'grouping_strategy', 'collection_attribute',
        'enable_tabs', true,
        'allow_upload', true,
        'show_completeness', true,
        'available_roles', ARRAY['packshot', 'lifestyle', 'detail', 'thumbnail']
    ),
    NULL,
    NULL,
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

-- Also ensure the product_assets relationship is properly configured
DELETE FROM directus_relations WHERE many_collection = 'product_assets' AND many_field = 'products_id' AND one_collection = 'products';

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
ON CONFLICT (many_collection, many_field, one_collection) DO NOTHING;