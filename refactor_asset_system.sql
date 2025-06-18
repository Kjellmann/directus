-- Comprehensive Asset System Refactoring
-- This creates proper lookup tables and relationships similar to Akeneo

-- 1. Create asset_roles lookup table
CREATE TABLE IF NOT EXISTS asset_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    label VARCHAR(255) NOT NULL,
    description TEXT,
    sort INTEGER DEFAULT 0,
    user_created UUID REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_updated UUID REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default roles
INSERT INTO asset_roles (code, label, description, sort) VALUES
    ('packshot', 'Packshot', 'Main product image on white background', 1),
    ('lifestyle', 'Lifestyle', 'Product in use or context', 2),
    ('detail', 'Detail', 'Close-up or detail shots', 3),
    ('thumbnail', 'Thumbnail', 'Small preview image', 4),
    ('360', '360° View', 'Interactive 360-degree view', 5),
    ('video_main', 'Main Video', 'Primary product video', 6),
    ('video_tutorial', 'Tutorial Video', 'How-to or instructional video', 7),
    ('manual', 'Manual', 'Product manual or instructions', 8),
    ('datasheet', 'Datasheet', 'Technical specifications document', 9),
    ('certificate', 'Certificate', 'Compliance or quality certificates', 10)
ON CONFLICT (code) DO NOTHING;

-- 2. Create asset_tags table for flexible tagging
CREATE TABLE IF NOT EXISTS asset_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    color VARCHAR(7) DEFAULT '#4A90E2',
    user_created UUID REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create junction table for asset tags (many-to-many)
CREATE TABLE IF NOT EXISTS asset_tags_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_tags_id UUID NOT NULL REFERENCES asset_tags(id) ON DELETE CASCADE,
    assets_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    UNIQUE(asset_tags_id, assets_id)
);

-- 4. Create asset_collection_types for better organization
CREATE TABLE IF NOT EXISTS asset_collection_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    label VARCHAR(255) NOT NULL,
    icon VARCHAR(50),
    sort INTEGER DEFAULT 0
);

INSERT INTO asset_collection_types (code, label, icon, sort) VALUES
    ('images', 'Product Images', 'image', 1),
    ('videos', 'Product Videos', 'videocam', 2),
    ('documents', 'Product Documents', 'description', 3),
    ('downloads', 'Downloads', 'download', 4),
    ('other', 'Other Assets', 'attachment', 5)
ON CONFLICT (code) DO NOTHING;

-- 5. Add proper columns to assets table
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS mime_type VARCHAR(255),
ADD COLUMN IF NOT EXISTS dimensions JSONB;

-- 6. Update product_assets to use role_id instead of role text
ALTER TABLE product_assets 
ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES asset_roles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS collection_type_id UUID REFERENCES asset_collection_types(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS tags TEXT[],
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Migrate existing role data to role_id
UPDATE product_assets pa
SET role_id = ar.id
FROM asset_roles ar
WHERE pa.role = ar.code
AND pa.role_id IS NULL;

-- Migrate collection_attribute to collection_type_id
UPDATE product_assets pa
SET collection_type_id = act.id
FROM asset_collection_types act
WHERE pa.collection_attribute = act.code
AND pa.collection_type_id IS NULL;

-- 7. Create asset_attributes table for dynamic attributes per asset family
CREATE TABLE IF NOT EXISTS asset_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_family_id UUID NOT NULL REFERENCES asset_families(id) ON DELETE CASCADE,
    code VARCHAR(255) NOT NULL,
    label VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- text, number, boolean, select, multiselect, date, media
    options JSONB, -- For select/multiselect types
    is_required BOOLEAN DEFAULT false,
    is_unique BOOLEAN DEFAULT false,
    validation_rules JSONB,
    sort INTEGER DEFAULT 0,
    UNIQUE(asset_family_id, code)
);

-- 8. Fix the assets_collection field in Directus
UPDATE directus_fields 
SET special = 'alias,o2m'
WHERE collection = 'products' AND field = 'assets_collection';

-- 9. Register all the new collections in Directus
INSERT INTO directus_collections (collection, icon, note, display_template, hidden, singleton, translations, archive_field, archive_app_filter, archive_value, unarchive_value, sort_field, accountability, color, item_duplication_fields, sort, "group", collapse, preview_url, versioning)
VALUES 
('asset_roles', 'label', 'Available roles for assets', '{{label}}', false, false, null, null, true, null, null, 'sort', 'all', '#2ECDA7', null, null, null, 'open', null, false),
('asset_tags', 'local_offer', 'Tags for asset organization', '{{name}}', false, false, null, null, true, null, null, null, 'all', '#FFA439', null, null, null, 'open', null, false),
('asset_collection_types', 'folder', 'Asset collection types', '{{label}}', false, false, null, null, true, null, null, 'sort', 'all', '#A2B5CD', null, null, null, 'open', null, false),
('asset_attributes', 'list_alt', 'Dynamic attributes for asset families', '{{label}}', false, false, null, null, true, null, null, 'sort', 'all', '#6644FF', null, null, null, 'open', null, false)
ON CONFLICT (collection) DO NOTHING;

-- 10. Register fields for asset_roles
INSERT INTO directus_fields (collection, field, special, interface, options, display, display_options, readonly, hidden, sort, width, translations, note) VALUES
('asset_roles', 'id', 'uuid', 'input', null, null, null, true, true, 1, 'full', null, null),
('asset_roles', 'code', null, 'input', '{"slug":true}', null, null, false, false, 2, 'half', null, 'Unique code for the role'),
('asset_roles', 'label', null, 'input', null, null, null, false, false, 3, 'half', null, 'Display name'),
('asset_roles', 'description', null, 'input-multiline', null, null, null, false, false, 4, 'full', null, 'Role description'),
('asset_roles', 'sort', null, 'input', '{"min":0}', null, null, false, false, 5, 'half', null, 'Display order')
ON CONFLICT (collection, field) DO NOTHING;

-- 11. Register fields for asset_collection_types
INSERT INTO directus_fields (collection, field, special, interface, options, display, display_options, readonly, hidden, sort, width, translations, note) VALUES
('asset_collection_types', 'id', 'uuid', 'input', null, null, null, true, true, 1, 'full', null, null),
('asset_collection_types', 'code', null, 'input', '{"slug":true}', null, null, false, false, 2, 'half', null, 'Unique code'),
('asset_collection_types', 'label', null, 'input', null, null, null, false, false, 3, 'half', null, 'Display name'),
('asset_collection_types', 'icon', null, 'select-icon', null, null, null, false, false, 4, 'half', null, 'Icon to display'),
('asset_collection_types', 'sort', null, 'input', '{"min":0}', null, null, false, false, 5, 'half', null, 'Display order')
ON CONFLICT (collection, field) DO NOTHING;

-- 12. Update product_assets fields in Directus
UPDATE directus_fields SET interface = 'select-dropdown-m2o', special = 'm2o' 
WHERE collection = 'product_assets' AND field = 'role_id';

UPDATE directus_fields SET interface = 'select-dropdown-m2o', special = 'm2o' 
WHERE collection = 'product_assets' AND field = 'collection_type_id';

-- 13. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_asset_roles_code ON asset_roles(code);
CREATE INDEX IF NOT EXISTS idx_asset_tags_name ON asset_tags(name);
CREATE INDEX IF NOT EXISTS idx_product_assets_role_id ON product_assets(role_id);
CREATE INDEX IF NOT EXISTS idx_product_assets_collection_type_id ON product_assets(collection_type_id);