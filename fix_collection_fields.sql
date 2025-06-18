-- Fix collection field registrations

-- Update collections with sort_field
UPDATE directus_collections 
SET sort_field = 'sort' 
WHERE collection IN ('asset_families', 'asset_family_attributes', 'assets', 'product_link_rules', 'product_assets');

-- Add missing sort fields to directus_fields
INSERT INTO directus_fields (collection, field, special, interface, options, display, display_options, readonly, hidden, sort, width, translations, note, conditions, required, "group", validation, validation_message)
VALUES
    ('asset_families', 'sort', NULL, 'input', '{"min":0}', NULL, NULL, false, false, 90, 'half', NULL, 'Sort order', NULL, false, NULL, NULL, NULL),
    ('asset_family_attributes', 'sort', NULL, 'input', '{"min":0}', NULL, NULL, false, false, 90, 'half', NULL, 'Sort order', NULL, false, NULL, NULL, NULL),
    ('assets', 'sort', NULL, 'input', '{"min":0}', NULL, NULL, false, false, 90, 'half', NULL, 'Sort order', NULL, false, NULL, NULL, NULL),
    ('product_link_rules', 'sort', NULL, 'input', '{"min":0}', NULL, NULL, false, false, 90, 'half', NULL, 'Sort order', NULL, false, NULL, NULL, NULL),
    ('product_assets', 'sort', NULL, 'input', '{"min":0}', NULL, NULL, false, false, 90, 'half', NULL, 'Sort order', NULL, false, NULL, NULL, NULL)
ON CONFLICT (collection, field) DO UPDATE
SET 
    interface = EXCLUDED.interface,
    options = EXCLUDED.options,
    note = EXCLUDED.note;

-- Ensure all system fields are properly registered for all collections
INSERT INTO directus_fields (collection, field, special, interface, options, display, display_options, readonly, hidden, sort, width, translations, note, conditions, required, "group", validation, validation_message)
SELECT 
    t.collection,
    'id',
    'uuid',
    'input',
    '{"disabled":true}',
    NULL,
    NULL,
    true,
    true,
    1,
    'full',
    NULL,
    NULL,
    NULL,
    false,
    NULL,
    NULL,
    NULL
FROM (VALUES ('asset_families'), ('asset_family_attributes'), ('assets'), ('product_link_rules'), ('product_assets')) AS t(collection)
ON CONFLICT (collection, field) DO NOTHING;

-- Register user_created field for all collections
INSERT INTO directus_fields (collection, field, special, interface, options, display, display_options, readonly, hidden, sort, width, translations, note, conditions, required, "group", validation, validation_message)
SELECT 
    t.collection,
    'user_created',
    'user-created',
    'select-dropdown-m2o',
    '{"template":"{{email}}"}',
    'user',
    NULL,
    true,
    true,
    98,
    'half',
    NULL,
    NULL,
    NULL,
    false,
    NULL,
    NULL,
    NULL
FROM (VALUES ('asset_families'), ('asset_family_attributes'), ('assets'), ('product_link_rules'), ('product_assets')) AS t(collection)
ON CONFLICT (collection, field) DO NOTHING;

-- Register date_created field for all collections
INSERT INTO directus_fields (collection, field, special, interface, options, display, display_options, readonly, hidden, sort, width, translations, note, conditions, required, "group", validation, validation_message)
SELECT 
    t.collection,
    'date_created',
    'date-created',
    'datetime',
    NULL,
    'datetime',
    '{"relative":true}',
    true,
    true,
    99,
    'half',
    NULL,
    NULL,
    NULL,
    false,
    NULL,
    NULL,
    NULL
FROM (VALUES ('asset_families'), ('asset_family_attributes'), ('assets'), ('product_link_rules'), ('product_assets')) AS t(collection)
ON CONFLICT (collection, field) DO NOTHING;

-- Register user_updated field for all collections
INSERT INTO directus_fields (collection, field, special, interface, options, display, display_options, readonly, hidden, sort, width, translations, note, conditions, required, "group", validation, validation_message)
SELECT 
    t.collection,
    'user_updated',
    'user-updated',
    'select-dropdown-m2o',
    '{"template":"{{email}}"}',
    'user',
    NULL,
    true,
    true,
    100,
    'half',
    NULL,
    NULL,
    NULL,
    false,
    NULL,
    NULL,
    NULL
FROM (VALUES ('asset_families'), ('asset_family_attributes'), ('assets'), ('product_link_rules'), ('product_assets')) AS t(collection)
ON CONFLICT (collection, field) DO NOTHING;

-- Register date_updated field for all collections
INSERT INTO directus_fields (collection, field, special, interface, options, display, display_options, readonly, hidden, sort, width, translations, note, conditions, required, "group", validation, validation_message)
SELECT 
    t.collection,
    'date_updated',
    'date-updated',
    'datetime',
    NULL,
    'datetime',
    '{"relative":true}',
    true,
    true,
    101,
    'half',
    NULL,
    NULL,
    NULL,
    false,
    NULL,
    NULL,
    NULL
FROM (VALUES ('asset_families'), ('asset_family_attributes'), ('assets'), ('product_link_rules'), ('product_assets')) AS t(collection)
ON CONFLICT (collection, field) DO NOTHING;

-- Fix any missing required fields for asset_families specifically
INSERT INTO directus_fields (collection, field, special, interface, options, display, display_options, readonly, hidden, sort, width, translations, note, conditions, required, "group", validation, validation_message)
VALUES
    ('asset_families', 'code', NULL, 'input', '{"trim":true,"slug":true}', NULL, NULL, false, false, 2, 'half', NULL, 'Unique identifier for the asset family', NULL, true, NULL, NULL, NULL),
    ('asset_families', 'name', NULL, 'input', NULL, NULL, NULL, false, false, 3, 'half', NULL, 'Display name', NULL, true, NULL, NULL, NULL),
    ('asset_families', 'description', NULL, 'input-multiline', NULL, NULL, NULL, false, false, 4, 'full', NULL, NULL, NULL, false, NULL, NULL, NULL),
    ('asset_families', 'main_media_attribute', NULL, 'input', NULL, NULL, NULL, false, false, 5, 'half', NULL, 'Attribute code that contains the main media', NULL, false, NULL, NULL, NULL),
    ('asset_families', 'sort_field', NULL, 'input', NULL, NULL, NULL, false, false, 6, 'half', NULL, 'Field to use for default sorting', NULL, false, NULL, NULL, NULL)
ON CONFLICT (collection, field) DO UPDATE
SET 
    interface = EXCLUDED.interface,
    options = EXCLUDED.options,
    note = EXCLUDED.note,
    required = EXCLUDED.required;