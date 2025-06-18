-- Register Asset Management tables as Directus collections

-- First, let's check if collections exist and insert them
INSERT INTO directus_collections (collection, icon, note, display_template, hidden, singleton, translations, archive_field, archive_app_filter, archive_value, unarchive_value, sort_field, accountability, color, item_duplication_fields, sort, "group", collapse)
VALUES 
    ('asset_families', 'category', 'Asset type templates (images, videos, documents)', '{{name}}', false, false, null, null, true, null, null, 'sort', 'all', '#2ECDA7', null, 1, null, 'open'),
    ('asset_family_attributes', 'text_fields', 'Attribute schemas for asset families', '{{label}}', false, false, null, null, true, null, null, 'sort_order', 'all', '#2ECDA7', null, 2, null, 'open'),
    ('assets', 'perm_media', 'Digital assets with metadata', '{{label}} ({{code}})', false, false, null, null, true, null, null, null, 'all', '#2ECDA7', null, 3, null, 'open'),
    ('product_link_rules', 'link', 'Automatic asset-product linking rules', '{{name}}', false, false, null, null, true, null, null, 'priority', 'all', '#2ECDA7', null, 4, null, 'open'),
    ('product_assets', 'collections', 'Asset-Product relationships', null, false, false, null, null, true, null, null, 'sort', 'all', '#2ECDA7', null, 5, null, 'open')
ON CONFLICT (collection) DO UPDATE
SET 
    icon = EXCLUDED.icon,
    note = EXCLUDED.note,
    display_template = EXCLUDED.display_template;

-- Register fields for asset_families
INSERT INTO directus_fields (collection, field, special, interface, options, display, display_options, readonly, hidden, sort, width, translations, note, conditions, required, "group", validation, validation_message)
VALUES
    ('asset_families', 'id', 'uuid', 'input', null, null, null, true, true, 1, 'full', null, null, null, false, null, null, null),
    ('asset_families', 'code', null, 'input', '{"trim":true,"slug":true}', null, null, false, false, 2, 'half', null, 'Unique identifier for the asset family', null, true, null, null, null),
    ('asset_families', 'name', null, 'input', null, null, null, false, false, 3, 'half', null, 'Display name', null, true, null, null, null),
    ('asset_families', 'description', null, 'input-multiline', null, null, null, false, false, 4, 'full', null, null, null, false, null, null, null),
    ('asset_families', 'main_media_attribute', null, 'input', null, null, null, false, false, 5, 'half', null, 'Attribute code that contains the main media', null, false, null, null, null),
    ('asset_families', 'sort_field', null, 'input', null, null, null, false, false, 6, 'half', null, 'Field to use for default sorting', null, false, null, null, null)
ON CONFLICT (collection, field) DO UPDATE
SET 
    interface = EXCLUDED.interface,
    options = EXCLUDED.options,
    note = EXCLUDED.note;

-- Register fields for asset_family_attributes
INSERT INTO directus_fields (collection, field, special, interface, options, display, display_options, readonly, hidden, sort, width, translations, note, conditions, required, "group", validation, validation_message)
VALUES
    ('asset_family_attributes', 'id', 'uuid', 'input', null, null, null, true, true, 1, 'full', null, null, null, false, null, null, null),
    ('asset_family_attributes', 'asset_family_id', 'm2o', 'select-dropdown-m2o', '{"template":"{{name}}"}', null, null, false, false, 2, 'half', null, null, null, true, null, null, null),
    ('asset_family_attributes', 'attribute_code', null, 'input', '{"trim":true,"slug":true}', null, null, false, false, 3, 'half', null, 'Unique code for this attribute', null, true, null, null, null),
    ('asset_family_attributes', 'attribute_type', null, 'select-dropdown', '{"choices":[{"text":"Text","value":"text"},{"text":"Media File","value":"media_file"},{"text":"Media Link","value":"media_link"},{"text":"Boolean","value":"boolean"},{"text":"Number","value":"number"},{"text":"Select","value":"select"},{"text":"Multi Select","value":"multi_select"}]}', null, null, false, false, 4, 'half', null, null, null, true, null, null, null),
    ('asset_family_attributes', 'label', null, 'input', null, null, null, false, false, 5, 'half', null, null, null, true, null, null, null),
    ('asset_family_attributes', 'required', 'cast-boolean', 'boolean', null, null, null, false, false, 6, 'third', null, null, null, false, null, null, null),
    ('asset_family_attributes', 'localizable', 'cast-boolean', 'boolean', null, null, null, false, false, 7, 'third', null, null, null, false, null, null, null),
    ('asset_family_attributes', 'scopable', 'cast-boolean', 'boolean', null, null, null, false, false, 8, 'third', null, null, null, false, null, null, null),
    ('asset_family_attributes', 'sort_order', null, 'input', '{"min":0}', null, null, false, false, 9, 'half', null, null, null, false, null, null, null),
    ('asset_family_attributes', 'options', 'cast-json', 'input-code', '{"language":"json"}', null, null, false, false, 10, 'full', null, 'Configuration for select/multi_select types', null, false, null, null, null)
ON CONFLICT (collection, field) DO UPDATE
SET 
    interface = EXCLUDED.interface,
    options = EXCLUDED.options,
    note = EXCLUDED.note;

-- Register fields for assets
INSERT INTO directus_fields (collection, field, special, interface, options, display, display_options, readonly, hidden, sort, width, translations, note, conditions, required, "group", validation, validation_message)
VALUES
    ('assets', 'id', 'uuid', 'input', null, null, null, true, true, 1, 'full', null, null, null, false, null, null, null),
    ('assets', 'asset_family_id', 'm2o', 'select-dropdown-m2o', '{"template":"{{name}}"}', null, null, false, false, 2, 'half', null, null, null, false, null, null, null),
    ('assets', 'code', null, 'input', '{"trim":true}', null, null, false, false, 3, 'half', null, 'Unique asset identifier', null, true, null, null, null),
    ('assets', 'label', null, 'input', null, null, null, false, false, 4, 'full', null, null, null, false, null, null, null),
    ('assets', 'main_media', 'file', 'file', null, null, null, false, false, 5, 'full', null, null, null, false, null, null, null),
    ('assets', 'values', 'cast-json', 'input-code', '{"language":"json"}', null, null, false, false, 6, 'full', null, 'Dynamic attribute values', null, false, null, null, null),
    ('assets', 'completeness_percentage', null, 'input', '{"min":0,"max":100}', 'formatted-value', '{"suffix":"%"}', true, false, 7, 'half', null, null, null, false, null, null, null),
    ('assets', 'enabled', 'cast-boolean', 'boolean', null, null, null, false, false, 8, 'half', null, null, null, false, null, null, null)
ON CONFLICT (collection, field) DO UPDATE
SET 
    interface = EXCLUDED.interface,
    options = EXCLUDED.options,
    display = EXCLUDED.display,
    display_options = EXCLUDED.display_options;

-- Register fields for product_link_rules
INSERT INTO directus_fields (collection, field, special, interface, options, display, display_options, readonly, hidden, sort, width, translations, note, conditions, required, "group", validation, validation_message)
VALUES
    ('product_link_rules', 'id', 'uuid', 'input', null, null, null, true, true, 1, 'full', null, null, null, false, null, null, null),
    ('product_link_rules', 'asset_family_id', 'm2o', 'select-dropdown-m2o', '{"template":"{{name}}"}', null, null, false, false, 2, 'half', null, null, null, false, null, null, null),
    ('product_link_rules', 'name', null, 'input', null, null, null, false, false, 3, 'half', null, null, null, true, null, null, null),
    ('product_link_rules', 'enabled', 'cast-boolean', 'boolean', null, null, null, false, false, 4, 'third', null, null, null, false, null, null, null),
    ('product_link_rules', 'regex_pattern', null, 'input-code', '{"language":"regex"}', null, null, false, false, 5, 'full', null, 'Regex pattern to match against asset code or filename', null, true, null, null, null),
    ('product_link_rules', 'target_attribute', null, 'input', null, null, null, false, false, 6, 'half', null, 'Product attribute to match against', null, false, null, null, null),
    ('product_link_rules', 'conditions', 'cast-json', 'input-code', '{"language":"json"}', null, null, false, false, 7, 'full', null, 'Additional conditions for filtering products', null, false, null, null, null),
    ('product_link_rules', 'priority', null, 'input', '{"min":0}', null, null, false, false, 8, 'third', null, 'Higher priority rules are executed first', null, false, null, null, null)
ON CONFLICT (collection, field) DO UPDATE
SET 
    interface = EXCLUDED.interface,
    options = EXCLUDED.options,
    note = EXCLUDED.note;

-- Register fields for product_assets
INSERT INTO directus_fields (collection, field, special, interface, options, display, display_options, readonly, hidden, sort, width, translations, note, conditions, required, "group", validation, validation_message)
VALUES
    ('product_assets', 'id', 'uuid', 'input', null, null, null, true, true, 1, 'full', null, null, null, false, null, null, null),
    ('product_assets', 'products_id', 'm2o', 'select-dropdown-m2o', '{"template":"{{uuid}}"}', null, null, false, false, 2, 'half', null, null, null, true, null, null, null),
    ('product_assets', 'assets_id', 'm2o', 'select-dropdown-m2o', '{"template":"{{label}} ({{code}})"}', null, null, false, false, 3, 'half', null, null, null, true, null, null, null),
    ('product_assets', 'collection_attribute', null, 'select-dropdown', '{"choices":[{"text":"Images","value":"images"},{"text":"Videos","value":"videos"},{"text":"Documents","value":"documents"},{"text":"Downloads","value":"downloads"}]}', null, null, false, false, 4, 'half', null, 'Asset collection type', null, true, null, null, null),
    ('product_assets', 'sort', null, 'input', '{"min":0}', null, null, false, false, 5, 'half', null, null, null, false, null, null, null),
    ('product_assets', 'role', null, 'select-dropdown', '{"choices":[{"text":"Packshot","value":"packshot"},{"text":"Lifestyle","value":"lifestyle"},{"text":"Detail","value":"detail"},{"text":"360 View","value":"360_view"},{"text":"Thumbnail","value":"thumbnail"}],"allowOther":true}', null, null, false, false, 6, 'half', null, null, null, false, null, null, null),
    ('product_assets', 'enabled', 'cast-boolean', 'boolean', null, null, null, false, false, 7, 'half', null, null, null, false, null, null, null)
ON CONFLICT (collection, field) DO UPDATE
SET 
    interface = EXCLUDED.interface,
    options = EXCLUDED.options,
    note = EXCLUDED.note;

-- Add system fields for all collections
INSERT INTO directus_fields (collection, field, special, interface, options, display, display_options, readonly, hidden, sort, width, translations, note, conditions, required, "group", validation, validation_message)
SELECT collection, 'user_created', 'user-created', 'select-dropdown-m2o', '{"template":"{{email}}"}', 'user', null, true, true, 98, 'half', null, null, null, false, null, null, null
FROM (VALUES ('asset_families'), ('asset_family_attributes'), ('assets'), ('product_link_rules'), ('product_assets')) AS t(collection)
ON CONFLICT (collection, field) DO NOTHING;

INSERT INTO directus_fields (collection, field, special, interface, options, display, display_options, readonly, hidden, sort, width, translations, note, conditions, required, "group", validation, validation_message)
SELECT collection, 'date_created', 'date-created', 'datetime', null, 'datetime', '{"relative":true}', true, true, 99, 'half', null, null, null, false, null, null, null
FROM (VALUES ('asset_families'), ('asset_family_attributes'), ('assets'), ('product_link_rules'), ('product_assets')) AS t(collection)
ON CONFLICT (collection, field) DO NOTHING;

INSERT INTO directus_fields (collection, field, special, interface, options, display, display_options, readonly, hidden, sort, width, translations, note, conditions, required, "group", validation, validation_message)
SELECT collection, 'user_updated', 'user-updated', 'select-dropdown-m2o', '{"template":"{{email}}"}', 'user', null, true, true, 100, 'half', null, null, null, false, null, null, null
FROM (VALUES ('asset_families'), ('asset_family_attributes'), ('assets'), ('product_link_rules'), ('product_assets')) AS t(collection)
ON CONFLICT (collection, field) DO NOTHING;

INSERT INTO directus_fields (collection, field, special, interface, options, display, display_options, readonly, hidden, sort, width, translations, note, conditions, required, "group", validation, validation_message)
SELECT collection, 'date_updated', 'date-updated', 'datetime', null, 'datetime', '{"relative":true}', true, true, 101, 'half', null, null, null, false, null, null, null
FROM (VALUES ('asset_families'), ('asset_family_attributes'), ('assets'), ('product_link_rules'), ('product_assets')) AS t(collection)
ON CONFLICT (collection, field) DO NOTHING;

-- Create relations
INSERT INTO directus_relations (many_collection, many_field, one_collection, one_field, one_collection_field, one_allowed_collections, junction_field, sort_field, one_deselect_action)
VALUES
    ('asset_family_attributes', 'asset_family_id', 'asset_families', null, null, null, null, null, 'nullify'),
    ('assets', 'asset_family_id', 'asset_families', null, null, null, null, null, 'nullify'),
    ('assets', 'main_media', 'directus_files', null, null, null, null, null, 'nullify'),
    ('product_link_rules', 'asset_family_id', 'asset_families', null, null, null, null, null, 'nullify'),
    ('product_assets', 'products_id', 'products', null, 'assets', null, 'assets_id', 'sort', 'nullify'),
    ('product_assets', 'assets_id', 'assets', null, 'products', null, 'products_id', 'sort', 'nullify')
ON CONFLICT DO NOTHING;