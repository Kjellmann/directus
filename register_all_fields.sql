-- Complete field registration for asset management collections

-- Asset Families fields
INSERT INTO directus_fields (collection, field, special, interface, options, display, readonly, hidden, sort, width, note, required)
SELECT 'asset_families', field_name, special_type, interface_type, options_json, display_type, is_readonly, is_hidden, sort_order, field_width, field_note, is_required
FROM (VALUES 
    ('id', 'uuid', 'input', '{"disabled":true}', NULL, true, true, 1, 'full', 'Primary Key', false),
    ('code', NULL, 'input', '{"trim":true,"slug":true}', NULL, false, false, 2, 'half', 'Unique identifier', true),
    ('name', NULL, 'input', NULL, NULL, false, false, 3, 'half', 'Display name', true),
    ('description', NULL, 'input-multiline', NULL, NULL, false, false, 4, 'full', 'Description', false),
    ('main_media_attribute', NULL, 'input', NULL, NULL, false, false, 5, 'half', 'Main media attribute code', false),
    ('sort_field', NULL, 'input', NULL, NULL, false, false, 6, 'half', 'Default sort field', false),
    ('sort', NULL, 'input', '{"min":0}', NULL, false, false, 7, 'half', 'Sort order', false),
    ('user_created', 'user-created', 'select-dropdown-m2o', '{"template":"{{email}}"}', 'user', true, true, 98, 'half', NULL, false),
    ('date_created', 'date-created', 'datetime', NULL, 'datetime', true, true, 99, 'half', NULL, false),
    ('user_updated', 'user-updated', 'select-dropdown-m2o', '{"template":"{{email}}"}', 'user', true, true, 100, 'half', NULL, false),
    ('date_updated', 'date-updated', 'datetime', NULL, 'datetime', true, true, 101, 'half', NULL, false)
) AS fields(field_name, special_type, interface_type, options_json, display_type, is_readonly, is_hidden, sort_order, field_width, field_note, is_required)
WHERE NOT EXISTS (SELECT 1 FROM directus_fields WHERE collection = 'asset_families' AND field = field_name);

-- Asset Family Attributes fields
INSERT INTO directus_fields (collection, field, special, interface, options, display, readonly, hidden, sort, width, note, required)
SELECT 'asset_family_attributes', field_name, special_type, interface_type, options_json, display_type, is_readonly, is_hidden, sort_order, field_width, field_note, is_required
FROM (VALUES 
    ('id', 'uuid', 'input', '{"disabled":true}', NULL, true, true, 1, 'full', 'Primary Key', false),
    ('asset_family_id', 'm2o', 'select-dropdown-m2o', '{"template":"{{name}}"}', NULL, false, false, 2, 'half', 'Asset Family', true),
    ('attribute_code', NULL, 'input', '{"trim":true,"slug":true}', NULL, false, false, 3, 'half', 'Attribute code', true),
    ('attribute_type', NULL, 'select-dropdown', '{"choices":[{"text":"Text","value":"text"},{"text":"Media File","value":"media_file"},{"text":"Media Link","value":"media_link"},{"text":"Boolean","value":"boolean"},{"text":"Number","value":"number"},{"text":"Select","value":"select"},{"text":"Multi Select","value":"multi_select"}]}', NULL, false, false, 4, 'half', 'Attribute type', true),
    ('label', NULL, 'input', NULL, NULL, false, false, 5, 'half', 'Display label', true),
    ('required', 'cast-boolean', 'boolean', NULL, NULL, false, false, 6, 'third', 'Required field', false),
    ('localizable', 'cast-boolean', 'boolean', NULL, NULL, false, false, 7, 'third', 'Localizable', false),
    ('scopable', 'cast-boolean', 'boolean', NULL, NULL, false, false, 8, 'third', 'Scopable', false),
    ('sort_order', NULL, 'input', '{"min":0}', NULL, false, false, 9, 'half', 'Sort order', false),
    ('options', 'cast-json', 'input-code', '{"language":"json"}', NULL, false, false, 10, 'full', 'Options (for select types)', false),
    ('sort', NULL, 'input', '{"min":0}', NULL, false, false, 11, 'half', 'Sort', false)
) AS fields(field_name, special_type, interface_type, options_json, display_type, is_readonly, is_hidden, sort_order, field_width, field_note, is_required)
WHERE NOT EXISTS (SELECT 1 FROM directus_fields WHERE collection = 'asset_family_attributes' AND field = field_name);

-- Assets fields
INSERT INTO directus_fields (collection, field, special, interface, options, display, readonly, hidden, sort, width, note, required)
SELECT 'assets', field_name, special_type, interface_type, options_json, display_type, is_readonly, is_hidden, sort_order, field_width, field_note, is_required
FROM (VALUES 
    ('id', 'uuid', 'input', '{"disabled":true}', NULL, true, true, 1, 'full', 'Primary Key', false),
    ('asset_family_id', 'm2o', 'select-dropdown-m2o', '{"template":"{{name}}"}', NULL, false, false, 2, 'half', 'Asset Family', false),
    ('code', NULL, 'input', '{"trim":true}', NULL, false, false, 3, 'half', 'Asset code', true),
    ('label', NULL, 'input', NULL, NULL, false, false, 4, 'full', 'Asset label', false),
    ('main_media', 'file', 'file', NULL, NULL, false, false, 5, 'full', 'Main media file', false),
    ('values', 'cast-json', 'input-code', '{"language":"json"}', NULL, false, false, 6, 'full', 'Attribute values', false),
    ('completeness_percentage', NULL, 'input', '{"min":0,"max":100}', 'formatted-value', true, false, 7, 'half', 'Completeness %', false),
    ('enabled', 'cast-boolean', 'boolean', NULL, NULL, false, false, 8, 'half', 'Enabled', false),
    ('sort', NULL, 'input', '{"min":0}', NULL, false, false, 9, 'half', 'Sort', false)
) AS fields(field_name, special_type, interface_type, options_json, display_type, is_readonly, is_hidden, sort_order, field_width, field_note, is_required)
WHERE NOT EXISTS (SELECT 1 FROM directus_fields WHERE collection = 'assets' AND field = field_name);

-- Product Link Rules fields
INSERT INTO directus_fields (collection, field, special, interface, options, display, readonly, hidden, sort, width, note, required)
SELECT 'product_link_rules', field_name, special_type, interface_type, options_json, display_type, is_readonly, is_hidden, sort_order, field_width, field_note, is_required
FROM (VALUES 
    ('id', 'uuid', 'input', '{"disabled":true}', NULL, true, true, 1, 'full', 'Primary Key', false),
    ('asset_family_id', 'm2o', 'select-dropdown-m2o', '{"template":"{{name}}"}', NULL, false, false, 2, 'half', 'Asset Family', false),
    ('name', NULL, 'input', NULL, NULL, false, false, 3, 'half', 'Rule name', true),
    ('enabled', 'cast-boolean', 'boolean', NULL, NULL, false, false, 4, 'third', 'Enabled', false),
    ('regex_pattern', NULL, 'input-code', '{"language":"regex"}', NULL, false, false, 5, 'full', 'Regex pattern', true),
    ('target_attribute', NULL, 'input', NULL, NULL, false, false, 6, 'half', 'Target attribute', false),
    ('conditions', 'cast-json', 'input-code', '{"language":"json"}', NULL, false, false, 7, 'full', 'Additional conditions', false),
    ('priority', NULL, 'input', '{"min":0}', NULL, false, false, 8, 'third', 'Priority', false),
    ('sort', NULL, 'input', '{"min":0}', NULL, false, false, 9, 'half', 'Sort', false)
) AS fields(field_name, special_type, interface_type, options_json, display_type, is_readonly, is_hidden, sort_order, field_width, field_note, is_required)
WHERE NOT EXISTS (SELECT 1 FROM directus_fields WHERE collection = 'product_link_rules' AND field = field_name);

-- Product Assets fields
INSERT INTO directus_fields (collection, field, special, interface, options, display, readonly, hidden, sort, width, note, required)
SELECT 'product_assets', field_name, special_type, interface_type, options_json, display_type, is_readonly, is_hidden, sort_order, field_width, field_note, is_required
FROM (VALUES 
    ('id', 'uuid', 'input', '{"disabled":true}', NULL, true, true, 1, 'full', 'Primary Key', false),
    ('products_id', 'm2o', 'select-dropdown-m2o', '{"template":"{{uuid}}"}', NULL, false, false, 2, 'half', 'Product', true),
    ('assets_id', 'm2o', 'select-dropdown-m2o', '{"template":"{{label}} ({{code}})"}', NULL, false, false, 3, 'half', 'Asset', true),
    ('collection_attribute', NULL, 'select-dropdown', '{"choices":[{"text":"Images","value":"images"},{"text":"Videos","value":"videos"},{"text":"Documents","value":"documents"},{"text":"Downloads","value":"downloads"}]}', NULL, false, false, 4, 'half', 'Collection type', true),
    ('sort', NULL, 'input', '{"min":0}', NULL, false, false, 5, 'half', 'Sort order', false),
    ('role', NULL, 'select-dropdown', '{"choices":[{"text":"Packshot","value":"packshot"},{"text":"Lifestyle","value":"lifestyle"},{"text":"Detail","value":"detail"},{"text":"360 View","value":"360_view"},{"text":"Thumbnail","value":"thumbnail"}],"allowOther":true}', NULL, false, false, 6, 'half', 'Asset role', false),
    ('enabled', 'cast-boolean', 'boolean', NULL, NULL, false, false, 7, 'half', 'Enabled', false)
) AS fields(field_name, special_type, interface_type, options_json, display_type, is_readonly, is_hidden, sort_order, field_width, field_note, is_required)
WHERE NOT EXISTS (SELECT 1 FROM directus_fields WHERE collection = 'product_assets' AND field = field_name);