-- Add variant_attributes_hash column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS variant_attributes_hash VARCHAR(64);

-- Add index for better performance when looking up variants
CREATE INDEX IF NOT EXISTS idx_products_variant_hash 
ON products(variant_attributes_hash) 
WHERE variant_attributes_hash IS NOT NULL;

-- Add index for parent product lookups
CREATE INDEX IF NOT EXISTS idx_products_parent_product 
ON products(parent_product_id) 
WHERE parent_product_id IS NOT NULL;