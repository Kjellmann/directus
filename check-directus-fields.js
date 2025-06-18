const checkDirectusFields = async () => {
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
  
  // Check directus_fields table directly
  const sqlResp = await fetch('http://localhost:8055/items/directus_fields?filter[collection][_eq]=products&filter[field][_starts_with]=attr_&limit=3', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (sqlResp.status === 200) {
    const data = await sqlResp.json();
    console.log('=== DIRECTUS_FIELDS ENTRIES ===');
    console.log(`Total attr_ fields: ${data.data?.length || 0}`);
    
    if (data.data?.length > 0) {
      console.log('\nSample field configuration:');
      const field = data.data[0];
      console.log(`Field: ${field.field}`);
      console.log(`Special: ${field.special}`);
      console.log(`Interface: ${field.interface}`);
      console.log(`Hidden: ${field.hidden}`);
      console.log(`Readonly: ${field.readonly}`);
      console.log(`Conditions:`, field.conditions);
    }
  }
  
  // Try updating a field to remove conditions
  console.log('\n=== TESTING SIMPLIFIED FIELD ===');
  
  // Update attr_name to have no conditions
  const updateResp = await fetch('http://localhost:8055/fields/products/attr_name', {
    method: 'PATCH',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      meta: {
        hidden: false,
        readonly: false,
        conditions: null  // Remove conditions
      }
    })
  });
  
  console.log(`Update field status: ${updateResp.status}`);
  
  // Now try to query with the simplified field
  const testResp = await fetch('http://localhost:8055/items/products?limit=1&fields=id,attr_name', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  console.log(`\nQuery with simplified field status: ${testResp.status}`);
  
  if (testResp.status === 200) {
    const result = await testResp.json();
    console.log('Success! Result:', JSON.stringify(result.data, null, 2));
  } else {
    const error = await testResp.json();
    console.log('Error:', JSON.stringify(error, null, 2));
  }
};

checkDirectusFields().catch(console.error);