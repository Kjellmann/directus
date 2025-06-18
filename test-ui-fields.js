const testUIFields = async () => {
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
  
  // Test 1: Get all fields
  const allFieldsResponse = await fetch('http://localhost:8055/fields', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const allFieldsData = await allFieldsResponse.json();
  const productFields = allFieldsData.data?.filter(f => f.collection === 'products');
  const attrFields = productFields?.filter(f => f.field.startsWith('attr_'));
  
  console.log('=== ALL FIELDS ENDPOINT ===');
  console.log('Total product fields:', productFields?.length);
  console.log('Attribute fields:', attrFields?.length);
  
  // Test 2: Get product-specific fields
  const productFieldsResponse = await fetch('http://localhost:8055/fields/products', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const productFieldsData = await productFieldsResponse.json();
  const specificAttrFields = productFieldsData.data?.filter(f => f.field.startsWith('attr_'));
  
  console.log('\n=== PRODUCT FIELDS ENDPOINT ===');
  console.log('Total fields:', productFieldsData.data?.length);
  console.log('Attribute fields:', specificAttrFields?.length);
  
  if (specificAttrFields?.length > 0) {
    console.log('\nAttribute field details:');
    specificAttrFields.forEach(f => {
      console.log(`\n${f.field}:`);
      console.log(`  Type: ${f.type}`);
      console.log(`  Interface: ${f.meta?.interface}`);
      console.log(`  Display: ${f.meta?.display}`);
      console.log(`  Hidden: ${f.meta?.hidden}`);
      console.log(`  Special: ${f.meta?.special?.join(',')}`);
    });
  }
  
  // Test 3: Check collections endpoint
  const collectionsResponse = await fetch('http://localhost:8055/collections/products', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const collectionsData = await collectionsResponse.json();
  console.log('\n=== COLLECTIONS ENDPOINT ===');
  console.log('Products collection exists:', !!collectionsData.data);
};

testUIFields().catch(console.error);