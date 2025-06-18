const testEndpoints = async () => {
  console.log('Testing /fields endpoint...');
  
  // Test 1: /fields
  const res1 = await fetch('http://localhost:8055/fields');
  const data1 = await res1.json();
  console.log(`/fields - Status: ${res1.status}, Data: ${data1.data ? data1.data.length + ' fields' : 'No data'}`);
  
  // Test 2: /fields/products
  const res2 = await fetch('http://localhost:8055/fields/products');
  const data2 = await res2.json();
  console.log(`/fields/products - Status: ${res2.status}`);
  
  if (data2.data) {
    console.log(`Total fields: ${data2.data.length}`);
    const attrFields = data2.data.filter(f => f.field.startsWith('attr_'));
    console.log(`Attr fields: ${attrFields.length}`);
    if (attrFields.length > 0) {
      console.log('First attr field:', JSON.stringify(attrFields[0], null, 2));
    }
  } else if (data2.errors) {
    console.log('Errors:', data2.errors);
  }
  
  // Test 3: Check database directly via custom endpoint
  console.log('\nChecking what Directus sees internally...');
};

testEndpoints().catch(console.error);