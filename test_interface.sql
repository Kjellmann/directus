-- Test if the asset-collection interface is working

-- First check available interfaces in the field
SELECT DISTINCT interface FROM directus_fields WHERE interface IS NOT NULL ORDER BY interface;

-- Check our specific field
SELECT collection, field, interface, options FROM directus_fields 
WHERE field = 'product_assets' AND collection = 'products';

-- Create a simple test field on a test collection if it doesn't exist
-- (You can use this in the Directus admin to test the interface)