-- Asset Management System for Directus
-- This creates a comprehensive asset management system similar to Akeneo

-- Create asset_families collection
CREATE TABLE IF NOT EXISTS asset_families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    main_media_attribute VARCHAR(255),
    sort_field VARCHAR(255),
    user_created UUID REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_updated UUID REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_asset_families_code ON asset_families(code);
CREATE INDEX IF NOT EXISTS idx_asset_families_date_created ON asset_families(date_created);

-- Create asset_family_attributes collection
CREATE TABLE IF NOT EXISTS asset_family_attributes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_family_id UUID NOT NULL REFERENCES asset_families(id) ON DELETE CASCADE,
    attribute_code VARCHAR(255) NOT NULL,
    attribute_type VARCHAR(50) NOT NULL CHECK (attribute_type IN ('text', 'media_file', 'media_link', 'boolean', 'number', 'select', 'multi_select')),
    label VARCHAR(255) NOT NULL,
    required BOOLEAN DEFAULT false,
    localizable BOOLEAN DEFAULT false,
    scopable BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    options JSONB, -- For select/multi_select options
    user_created UUID REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_updated UUID REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated TIMESTAMP,
    UNIQUE(asset_family_id, attribute_code)
);

CREATE INDEX IF NOT EXISTS idx_asset_family_attributes_family ON asset_family_attributes(asset_family_id);
CREATE INDEX IF NOT EXISTS idx_asset_family_attributes_code ON asset_family_attributes(attribute_code);

-- Create assets collection
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_family_id UUID REFERENCES asset_families(id) ON DELETE SET NULL,
    code VARCHAR(255) UNIQUE NOT NULL,
    label VARCHAR(255),
    main_media UUID REFERENCES directus_files(id) ON DELETE SET NULL,
    values JSONB, -- Dynamic attribute values based on family schema
    completeness_percentage INTEGER DEFAULT 0,
    enabled BOOLEAN DEFAULT true,
    user_created UUID REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_updated UUID REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assets_family ON assets(asset_family_id);
CREATE INDEX IF NOT EXISTS idx_assets_code ON assets(code);
CREATE INDEX IF NOT EXISTS idx_assets_enabled ON assets(enabled);
CREATE INDEX IF NOT EXISTS idx_assets_date_created ON assets(date_created);

-- Create product_link_rules collection
CREATE TABLE IF NOT EXISTS product_link_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_family_id UUID REFERENCES asset_families(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    regex_pattern TEXT NOT NULL,
    target_attribute VARCHAR(255), -- Which product attribute to match against
    conditions JSONB, -- Additional conditions for filtering products
    priority INTEGER DEFAULT 0,
    user_created UUID REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_updated UUID REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_link_rules_family ON product_link_rules(asset_family_id);
CREATE INDEX IF NOT EXISTS idx_product_link_rules_enabled ON product_link_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_product_link_rules_priority ON product_link_rules(priority);

-- Create unified product_assets junction table
CREATE TABLE IF NOT EXISTS product_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    products_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    assets_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    collection_attribute VARCHAR(50) NOT NULL, -- 'images', 'videos', 'documents', etc.
    sort INTEGER DEFAULT 0,
    role VARCHAR(100), -- 'packshot', 'lifestyle', 'detail', etc.
    enabled BOOLEAN DEFAULT true,
    user_created UUID REFERENCES directus_users(id) ON DELETE SET NULL,
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_updated UUID REFERENCES directus_users(id) ON DELETE SET NULL,
    date_updated TIMESTAMP,
    UNIQUE(products_id, assets_id, collection_attribute)
);

CREATE INDEX IF NOT EXISTS idx_product_assets_product ON product_assets(products_id);
CREATE INDEX IF NOT EXISTS idx_product_assets_asset ON product_assets(assets_id);
CREATE INDEX IF NOT EXISTS idx_product_assets_collection ON product_assets(collection_attribute);
CREATE INDEX IF NOT EXISTS idx_product_assets_sort ON product_assets(sort);
CREATE INDEX IF NOT EXISTS idx_product_assets_enabled ON product_assets(enabled);

-- Create view for efficient "linked products" queries
CREATE OR REPLACE VIEW asset_linked_products AS
SELECT 
    a.id as asset_id,
    a.code as asset_code,
    a.label as asset_label,
    p.id as product_id,
    p.sku as product_sku,
    p.name as product_name,
    pa.collection_attribute,
    pa.role,
    pa.sort,
    pa.enabled as link_enabled
FROM assets a
INNER JOIN product_assets pa ON a.id = pa.assets_id
INNER JOIN products p ON pa.products_id = p.id
WHERE a.enabled = true;

-- Create function for completeness calculation
CREATE OR REPLACE FUNCTION calculate_asset_completeness(asset_id UUID)
RETURNS INTEGER AS $$
DECLARE
    total_required INTEGER;
    filled_required INTEGER;
    completeness INTEGER;
BEGIN
    -- Count total required attributes for the asset's family
    SELECT COUNT(*)
    INTO total_required
    FROM asset_family_attributes afa
    WHERE afa.asset_family_id = (
        SELECT asset_family_id FROM assets WHERE id = asset_id
    )
    AND afa.required = true;
    
    -- If no required attributes, return 100%
    IF total_required = 0 THEN
        RETURN 100;
    END IF;
    
    -- Count filled required attributes
    SELECT COUNT(*)
    INTO filled_required
    FROM asset_family_attributes afa
    WHERE afa.asset_family_id = (
        SELECT asset_family_id FROM assets WHERE id = asset_id
    )
    AND afa.required = true
    AND EXISTS (
        SELECT 1
        FROM assets a
        WHERE a.id = asset_id
        AND a.values->afa.attribute_code IS NOT NULL
        AND a.values->afa.attribute_code != 'null'::jsonb
        AND LENGTH(a.values->>afa.attribute_code) > 0
    );
    
    -- Calculate percentage
    completeness := ROUND((filled_required::NUMERIC / total_required::NUMERIC) * 100);
    
    RETURN completeness;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update completeness on asset update
CREATE OR REPLACE FUNCTION update_asset_completeness()
RETURNS TRIGGER AS $$
BEGIN
    NEW.completeness_percentage := calculate_asset_completeness(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS asset_completeness_trigger ON assets;
CREATE TRIGGER asset_completeness_trigger
BEFORE INSERT OR UPDATE ON assets
FOR EACH ROW
EXECUTE FUNCTION update_asset_completeness();

-- Sample data to get started
INSERT INTO asset_families (code, name, description, main_media_attribute) 
VALUES 
    ('product_images', 'Product Images', 'High-quality product photography', 'file'),
    ('product_videos', 'Product Videos', 'Product demonstration and promotional videos', 'file'),
    ('product_documents', 'Product Documents', 'Technical specifications, manuals, and certificates', 'file')
ON CONFLICT (code) DO NOTHING;

-- Sample attributes for product images family
INSERT INTO asset_family_attributes (asset_family_id, attribute_code, attribute_type, label, required, sort_order)
SELECT 
    af.id,
    attrs.attribute_code,
    attrs.attribute_type,
    attrs.label,
    attrs.required,
    attrs.sort_order
FROM asset_families af
CROSS JOIN (
    VALUES 
        ('file', 'media_file', 'Image File', true, 1),
        ('alt_text', 'text', 'Alt Text', true, 2),
        ('title', 'text', 'Title', false, 3),
        ('photographer', 'text', 'Photographer', false, 4),
        ('shot_date', 'text', 'Shot Date', false, 5),
        ('usage_rights', 'select', 'Usage Rights', false, 6)
) AS attrs(attribute_code, attribute_type, label, required, sort_order)
WHERE af.code = 'product_images'
ON CONFLICT (asset_family_id, attribute_code) DO NOTHING;

-- Update the options for usage_rights
UPDATE asset_family_attributes 
SET options = '{"choices": [{"value": "unlimited", "label": "Unlimited"}, {"value": "web_only", "label": "Web Only"}, {"value": "print_only", "label": "Print Only"}, {"value": "restricted", "label": "Restricted"}]}'::jsonb
WHERE attribute_code = 'usage_rights' 
AND asset_family_id = (SELECT id FROM asset_families WHERE code = 'product_images');

COMMENT ON TABLE asset_families IS 'Defines templates/categories for different asset types';
COMMENT ON TABLE asset_family_attributes IS 'Flexible attribute schemas for each asset family';
COMMENT ON TABLE assets IS 'Stores actual assets with flexible attribute values';
COMMENT ON TABLE product_link_rules IS 'Automatic asset-to-product linking via regex patterns';
COMMENT ON TABLE product_assets IS 'Unified junction table for ALL asset-product relationships';