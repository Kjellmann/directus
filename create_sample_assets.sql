-- Create some sample assets for testing

-- First, let's get the asset family IDs
\set product_images_id `SELECT id FROM asset_families WHERE code = 'product_images' LIMIT 1`
\set product_videos_id `SELECT id FROM asset_families WHERE code = 'product_videos' LIMIT 1`
\set product_documents_id `SELECT id FROM asset_families WHERE code = 'product_documents' LIMIT 1`

-- Insert sample assets
INSERT INTO assets (code, label, asset_family_id, values, enabled) VALUES
('IMG_PRODUCT_001', 'Main Product Image', (SELECT id FROM asset_families WHERE code = 'product_images'), '{"alt_text": "Main product view", "title": "Product Hero Image"}', true),
('IMG_PRODUCT_002', 'Product Detail Image', (SELECT id FROM asset_families WHERE code = 'product_images'), '{"alt_text": "Detailed product view", "title": "Product Detail"}', true),
('VID_PRODUCT_001', 'Product Demo Video', (SELECT id FROM asset_families WHERE code = 'product_videos'), '{"duration": "120", "format": "mp4"}', true),
('DOC_SPEC_001', 'Technical Specifications', (SELECT id FROM asset_families WHERE code = 'product_documents'), '{"document_type": "specification", "language": "en"}', true),
('DOC_MANUAL_001', 'User Manual', (SELECT id FROM asset_families WHERE code = 'product_documents'), '{"document_type": "manual", "language": "en"}', true);

-- Insert sample product link rules
INSERT INTO product_link_rules (asset_family_id, name, enabled, regex_pattern, target_attribute, priority) VALUES
((SELECT id FROM asset_families WHERE code = 'product_images'), 'Product Image Auto-Link', true, 'PRODUCT_(\d+)', 'uuid', 1),
((SELECT id FROM asset_families WHERE code = 'product_videos'), 'Product Video Auto-Link', true, 'VID_PRODUCT_(\d+)', 'uuid', 1),
((SELECT id FROM asset_families WHERE code = 'product_documents'), 'Document Auto-Link', true, '(SPEC|MANUAL)_(\d+)', 'uuid', 1);

-- Create some sample product assets relationships manually for testing
-- (This assumes you have some products in your products table)
-- You can adjust the product IDs based on what exists in your system

-- Check if we have any products first
DO $$
DECLARE
    product_count INTEGER;
    sample_product_id UUID;
    image_asset_id UUID;
    video_asset_id UUID;
    doc_asset_id UUID;
BEGIN
    SELECT COUNT(*) INTO product_count FROM products LIMIT 1;
    
    IF product_count > 0 THEN
        -- Get the first product
        SELECT id INTO sample_product_id FROM products LIMIT 1;
        
        -- Get our sample assets
        SELECT id INTO image_asset_id FROM assets WHERE code = 'IMG_PRODUCT_001';
        SELECT id INTO video_asset_id FROM assets WHERE code = 'VID_PRODUCT_001';
        SELECT id INTO doc_asset_id FROM assets WHERE code = 'DOC_SPEC_001';
        
        -- Create relationships
        INSERT INTO product_assets (products_id, assets_id, collection_attribute, sort, enabled) VALUES
        (sample_product_id, image_asset_id, 'images', 0, true),
        (sample_product_id, video_asset_id, 'videos', 0, true),
        (sample_product_id, doc_asset_id, 'documents', 0, true)
        ON CONFLICT (products_id, assets_id, collection_attribute) DO NOTHING;
        
        RAISE NOTICE 'Created sample product-asset relationships for product %', sample_product_id;
    ELSE
        RAISE NOTICE 'No products found - skipping product-asset relationship creation';
    END IF;
END $$;

-- Display summary
SELECT 
    'Asset Families' as type,
    COUNT(*) as count
FROM asset_families
UNION ALL
SELECT 
    'Assets' as type,
    COUNT(*) as count
FROM assets
UNION ALL
SELECT 
    'Product Link Rules' as type,
    COUNT(*) as count
FROM product_link_rules
UNION ALL
SELECT 
    'Product Assets' as type,
    COUNT(*) as count
FROM product_assets;

-- Show sample data
SELECT 'Asset Families:' as info;
SELECT code, name, description FROM asset_families ORDER BY code;

SELECT 'Assets:' as info;
SELECT code, label, completeness_percentage, enabled FROM assets ORDER BY code;

SELECT 'Product Link Rules:' as info;
SELECT name, regex_pattern, enabled FROM product_link_rules ORDER BY priority;

-- Show linked products view
SELECT 'Asset Linked Products View:' as info;
SELECT asset_code, asset_label, product_uuid, collection_attribute, role FROM asset_linked_products LIMIT 10;