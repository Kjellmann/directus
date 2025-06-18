const clearCacheTest = async () => {
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
  
  // Clear cache
  console.log('=== CLEARING CACHE ===');
  const cacheResp = await fetch('http://localhost:8055/utils/cache/clear', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log(`Cache clear status: ${cacheResp.status}`);
  
  // Check if admin user
  const roleResp = await fetch('http://localhost:8055/users/me?fields=role.admin_access,role.name', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const roleData = await roleResp.json();
  console.log('\n=== USER ROLE ===');
  console.log('Role:', JSON.stringify(roleData.data?.role, null, 2));
  
  // Try with wildcard fields
  console.log('\n=== TESTING WITH WILDCARD ===');
  const wildcardResp = await fetch('http://localhost:8055/items/products?limit=1&fields=*', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (wildcardResp.status === 200) {
    const data = await wildcardResp.json();
    if (data.data?.length > 0) {
      const fields = Object.keys(data.data[0]);
      console.log(`Total fields returned: ${fields.length}`);
      console.log(`Attribute fields: ${fields.filter(f => f.startsWith('attr_')).length}`);
      console.log('All fields:', fields);
    }
  }
  
  // Check schema service
  console.log('\n=== CHECKING SCHEMA SERVICE ===');
  const schemaResp = await fetch('http://localhost:8055/schema/snapshot?apply=true', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  console.log(`Schema snapshot status: ${schemaResp.status}`);
  
  if (schemaResp.status === 200) {
    const schema = await schemaResp.json();
    if (schema.data?.collections?.products) {
      const productFields = Object.keys(schema.data.collections.products.fields || {});
      console.log(`Product fields in schema: ${productFields.length}`);
      console.log(`Attr fields in schema: ${productFields.filter(f => f.startsWith('attr_')).length}`);
    }
  }
};

clearCacheTest().catch(console.error);