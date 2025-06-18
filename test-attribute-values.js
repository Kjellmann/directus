const testAttributeValues = async () => {
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
  
  // Get a product with attribute values
  const productsResponse = await fetch('http://localhost:8055/items/products?limit=1&fields=id,attr_name,attr_sku,attr_price', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const productsData = await productsResponse.json();
  console.log('=== PRODUCT WITH ATTRIBUTE VALUES ===');
  console.log(JSON.stringify(productsData.data, null, 2));
  
  // Test filtering by attribute
  const filterResponse = await fetch('http://localhost:8055/items/products?filter[attr_name][_contains]=test', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const filterData = await filterResponse.json();
  console.log('\n=== FILTERED BY ATTRIBUTE ===');
  console.log('Found products:', filterData.data?.length || 0);
  
  // Check if fields appear in field selection
  const fieldsResponse = await fetch('http://localhost:8055/fields/products', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const fieldsData = await fieldsResponse.json();
  const selectableFields = fieldsData.data?.filter(f => !f.meta?.hidden && f.field.startsWith('attr_'));
  
  console.log('\n=== SELECTABLE ATTRIBUTE FIELDS ===');
  console.log('Count:', selectableFields?.length || 0);
  if (selectableFields?.length > 0) {
    console.log('Fields:', selectableFields.map(f => f.field).join(', '));
  }
};

testAttributeValues().catch(console.error);