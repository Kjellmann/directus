const testFieldVisibility = async () => {
  // Login
  const loginResponse = await fetch('http://localhost:8055/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'sondre@kjellmann.no',
      password: 'admin123',
      mode: 'json'
    })
  });
  
  const loginData = await loginResponse.json();
  const token = loginData.data?.access_token;
  
  console.log('=== TESTING FIELD VISIBILITY ===\n');
  
  // 1. Check if fields are in the API response
  const fieldsResp = await fetch('http://localhost:8055/fields/products', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const fields = await fieldsResp.json();
  const attrFields = fields.data?.filter(f => f.field.startsWith('attr_'));
  
  console.log('1. API Fields Check:');
  console.log(`   Total attribute fields: ${attrFields?.length || 0}`);
  console.log(`   Hidden fields: ${attrFields?.filter(f => f.meta?.hidden).length || 0}`);
  console.log(`   Visible fields: ${attrFields?.filter(f => !f.meta?.hidden).length || 0}`);
  
  // 2. Test with attribute values
  const productsResp = await fetch('http://localhost:8055/items/products?limit=1&fields=*,attr_name,attr_sku', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  console.log('\n2. Query Test:');
  console.log(`   Status: ${productsResp.status}`);
  
  if (productsResp.status === 200) {
    const products = await productsResp.json();
    console.log(`   Products returned: ${products.data?.length || 0}`);
    if (products.data?.length > 0) {
      console.log(`   Sample product fields:`, Object.keys(products.data[0]));
      console.log(`   attr_name value: ${products.data[0].attr_name}`);
      console.log(`   attr_sku value: ${products.data[0].attr_sku}`);
    }
  }
  
  // 3. Check collection metadata
  const collectionResp = await fetch('http://localhost:8055/collections/products', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const collection = await collectionResp.json();
  console.log('\n3. Collection Schema:');
  console.log(`   Total schema fields: ${Object.keys(collection.data?.schema?.fields || {}).length}`);
  console.log(`   Attribute fields in schema: ${Object.keys(collection.data?.schema?.fields || {}).filter(f => f.startsWith('attr_')).length}`);
  
  // 4. Check field permissions
  const meResp = await fetch('http://localhost:8055/users/me', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const me = await meResp.json();
  console.log('\n4. User Check:');
  console.log(`   User role: ${me.data?.role?.name || me.data?.role}`);
  console.log(`   Admin access: ${me.data?.role?.admin_access}`);
  
  // 5. Test filtering
  const filterResp = await fetch('http://localhost:8055/items/products?filter[attr_name][_nnull]=true', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  console.log('\n5. Filter Test:');
  console.log(`   Filter by attr_name status: ${filterResp.status}`);
  
  if (filterResp.status === 200) {
    const filtered = await filterResp.json();
    console.log(`   Products with attr_name: ${filtered.data?.length || 0}`);
  }
  
  // 6. Check if fields have conditions
  if (attrFields?.length > 0) {
    console.log('\n6. Field Conditions:');
    const sampleField = attrFields[0];
    console.log(`   Sample field: ${sampleField.field}`);
    console.log(`   Has conditions: ${!!sampleField.meta?.conditions}`);
    if (sampleField.meta?.conditions) {
      console.log(`   Conditions:`, JSON.stringify(sampleField.meta.conditions, null, 2));
    }
  }
};

testFieldVisibility().catch(console.error);