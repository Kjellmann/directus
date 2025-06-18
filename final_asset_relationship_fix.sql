-- Ensure all relationships for the asset system are properly configured

-- 1. Product -> Product Assets (via assets_collection alias field)
DELETE FROM directus_relations 
WHERE one_collection = 'products' 
AND one_field = 'assets_collection';

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
    'assets_collection',
    NULL,
    NULL,
    'assets_id',
    'sort',
    'nullify'
);

-- 2. Product Assets -> Products (M2O)
DELETE FROM directus_relations 
WHERE many_collection = 'product_assets' 
AND many_field = 'products_id'
AND one_field IS NULL;

INSERT INTO directus_relations (
    many_collection,
    many_field,
    one_collection,
    one_field
)
VALUES (
    'product_assets',
    'products_id',
    'products',
    NULL
);

-- 3. Product Assets -> Assets (M2O)
DELETE FROM directus_relations 
WHERE many_collection = 'product_assets' 
AND many_field = 'assets_id';

INSERT INTO directus_relations (
    many_collection,
    many_field,
    one_collection,
    one_field
)
VALUES (
    'product_assets',
    'assets_id',
    'assets',
    NULL
);

-- 4. Product Assets -> Asset Roles (M2O)
DELETE FROM directus_relations 
WHERE many_collection = 'product_assets' 
AND many_field = 'role_id';

INSERT INTO directus_relations (
    many_collection,
    many_field,
    one_collection,
    one_field
)
VALUES (
    'product_assets',
    'role_id',
    'asset_roles',
    NULL
);

-- 5. Product Assets -> Asset Collection Types (M2O)
DELETE FROM directus_relations 
WHERE many_collection = 'product_assets' 
AND many_field = 'collection_type_id';

INSERT INTO directus_relations (
    many_collection,
    many_field,
    one_collection,
    one_field
)
VALUES (
    'product_assets',
    'collection_type_id',
    'asset_collection_types',
    NULL
);