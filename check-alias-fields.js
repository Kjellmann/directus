const checkAliasFields = async () => {
  const response = await fetch('http://localhost:8055/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'sondre@kjellmann.no',
      password: 'admin123',
      mode: 'json'
    })
  });
  
  const { data } = await response.json();
  const token = data?.access_token;
  
  // Get all fields
  const fieldsResp = await fetch('http://localhost:8055/fields', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const fieldsData = await fieldsResp.json();
  const aliasFields = fieldsData.data?.filter(f => f.type === 'alias');
  
  console.log('=== ALL ALIAS FIELDS IN SYSTEM ===');
  console.log('Total alias fields:', aliasFields?.length);
  
  // Group by collection
  const byCollection = {};
  aliasFields?.forEach(f => {
    if (!byCollection[f.collection]) byCollection[f.collection] = [];
    byCollection[f.collection].push(f);
  });
  
  Object.entries(byCollection).forEach(([collection, fields]) => {
    console.log(`\n${collection}: ${fields.length} alias fields`);
    fields.forEach(f => {
      console.log(`  - ${f.field}: special=[${f.meta?.special?.join(',')}]`);
    });
  });
  
  // Check one working alias field
  const workingAlias = aliasFields?.find(f => f.collection !== 'products');
  if (workingAlias) {
    console.log('\n=== WORKING ALIAS FIELD EXAMPLE ===');
    console.log(JSON.stringify(workingAlias, null, 2));
  }
  
  // Check product_assets field specifically
  const productAssets = fieldsData.data?.find(f => f.collection === 'products' && f.field === 'product_assets');
  if (productAssets) {
    console.log('\n=== PRODUCT_ASSETS FIELD (WORKING ALIAS) ===');
    console.log(JSON.stringify(productAssets, null, 2));
  }
};

checkAliasFields().catch(console.error);