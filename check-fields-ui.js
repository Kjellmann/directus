const checkFieldsUI = async () => {
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
  
  // Get all fields including system fields
  const fieldsResp = await fetch('http://localhost:8055/fields/products', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const fieldsData = await fieldsResp.json();
  const fields = fieldsData.data || [];
  
  console.log('=== ALL PRODUCT FIELDS ===');
  console.log('Total fields:', fields.length);
  
  // Group fields by type
  const regularFields = fields.filter(f => !f.field.startsWith('attr_') && !f.meta?.system);
  const systemFields = fields.filter(f => f.meta?.system);
  const attrFields = fields.filter(f => f.field.startsWith('attr_'));
  
  console.log('Regular fields:', regularFields.length);
  console.log('System fields:', systemFields.length);
  console.log('Attribute fields:', attrFields.length);
  
  console.log('\nRegular field names:', regularFields.map(f => f.field));
  console.log('\nAttribute field details:');
  attrFields.forEach(f => {
    console.log(`  ${f.field}: type=${f.type}, interface=${f.meta?.interface}, display=${f.meta?.display}`);
  });
  
  // Check collections endpoint for field information
  const collectionResp = await fetch('http://localhost:8055/collections/products', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const collectionData = await collectionResp.json();
  console.log('\n=== COLLECTION INFO ===');
  console.log('Collection fields count:', Object.keys(collectionData.data?.schema?.fields || {}).length);
  
  // Check if attr fields are in schema
  const schemaFields = Object.keys(collectionData.data?.schema?.fields || {});
  const schemaAttrFields = schemaFields.filter(f => f.startsWith('attr_'));
  console.log('Schema attr_ fields:', schemaAttrFields.length);
  
  // Test a sample query with attr fields
  const itemsResp = await fetch('http://localhost:8055/items/products?limit=1&fields=id,attr_name,attr_sku', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const itemsData = await itemsResp.json();
  console.log('\n=== SAMPLE ITEM WITH ATTR FIELDS ===');
  console.log('Response:', JSON.stringify(itemsData.data, null, 2));
};

checkFieldsUI().catch(console.error);