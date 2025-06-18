const knex = require('knex');

const db = knex({
  client: 'mysql2',
  connection: {
    host: 'localhost',
    port: 3306,
    user: 'directus',
    password: 'directus',
    database: 'directus'
  }
});

async function testProductAssets() {
  try {
    console.log('Testing product assets query...');
    
    // Test 1: Check product_assets table structure
    const productAssets = await db('product_assets').limit(1);
    console.log('\nSample product_assets record:', productAssets[0]);
    
    // Test 2: Check assets table structure
    const assets = await db('assets').limit(1);
    console.log('\nSample assets record:', assets[0]);
    
    // Test 3: Check specific product assets
    const specificProductAssets = await db('product_assets')
      .where('products_id', 'ea4c19a9-bb4a-417b-b8db-49842c252619');
    console.log('\nAssets for product ea4c19a9:', specificProductAssets);
    
    // Test 4: Try the join query
    const joinedAssets = await db('product_assets')
      .where('products_id', 'ea4c19a9-bb4a-417b-b8db-49842c252619')
      .join('assets', 'product_assets.assets_id', 'assets.id')
      .select(
        'product_assets.products_id',
        'product_assets.sort',
        'assets.id as asset_id',
        'assets.code as asset_code',
        'assets.label as asset_label',
        'assets.main_media'
      );
    console.log('\nJoined assets:', joinedAssets);
    
    // Test 5: Check if main_media exists
    if (joinedAssets.length > 0 && joinedAssets[0].main_media) {
      const files = await db('directus_files')
        .where('id', joinedAssets[0].main_media);
      console.log('\nDirectus files:', files);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.destroy();
  }
}

testProductAssets();