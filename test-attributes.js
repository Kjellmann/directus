const testAttributes = async () => {
  // First login
  const loginResponse = await fetch('http://localhost:8055/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'sondre@kjellmann.no',
      password: 'admin123',
      mode: 'json'
    })
  });
  
  const loginData = await loginResponse.json();
  const token = loginData.data?.access_token;
  
  if (!token) {
    console.error('No access token');
    return;
  }
  
  // Check attributes
  const attrResponse = await fetch('http://localhost:8055/items/attributes?filter[usable_in_grid][_eq]=true', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const attrData = await attrResponse.json();
  console.log('=== GRID-ENABLED ATTRIBUTES ===');
  console.log('Total:', attrData.data?.length || 0);
  
  if (attrData.data?.length > 0) {
    console.log('\nAttributes:');
    attrData.data.forEach(attr => {
      console.log(`- ${attr.code} (${attr.label})`);
    });
  }
  
  // Check sync endpoint
  const syncResponse = await fetch('http://localhost:8055/product-attributes-schema/sync', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const syncData = await syncResponse.json();
  console.log('\n=== SYNC RESULT ===');
  console.log(JSON.stringify(syncData, null, 2));
  
  // Check fields again after sync
  const fieldsResponse = await fetch('http://localhost:8055/fields/products', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const fieldsData = await fieldsResponse.json();
  const attrFields = fieldsData.data?.filter(f => f.field.startsWith('attr_'));
  
  console.log('\n=== FIELDS AFTER SYNC ===');
  console.log('Total product fields:', fieldsData.data?.length);
  console.log('Attribute fields:', attrFields?.length);
  
  if (attrFields?.length > 0) {
    console.log('\nAttribute fields found:');
    attrFields.forEach(f => {
      console.log(`- ${f.field}`);
    });
  }
};

testAttributes().catch(console.error);