const testPermissions = async () => {
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
  
  // Check permissions
  const permissionsResponse = await fetch('http://localhost:8055/permissions', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const permissionsData = await permissionsResponse.json();
  const productPermissions = permissionsData.data?.filter(p => p.collection === 'products');
  
  console.log('=== PERMISSIONS ===');
  console.log('Product permissions:', productPermissions?.length);
  
  // Check if there are field-specific permissions
  const fieldPermissions = productPermissions?.filter(p => p.fields && p.fields.length > 0);
  console.log('Permissions with field restrictions:', fieldPermissions?.length);
  
  if (fieldPermissions?.length > 0) {
    fieldPermissions.forEach(p => {
      console.log(`\nRole ${p.role}:`);
      console.log('Fields:', p.fields);
      const hasAttrFields = p.fields.some(f => f.startsWith('attr_'));
      console.log('Has attr_ fields:', hasAttrFields);
    });
  }
  
  // Check current user info
  const meResponse = await fetch('http://localhost:8055/users/me', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const meData = await meResponse.json();
  console.log('\n=== CURRENT USER ===');
  console.log('Role:', meData.data?.role);
  console.log('Admin access:', meData.data?.role?.admin_access);
  
  // Check fields in field management
  const fieldsResponse = await fetch('http://localhost:8055/fields/products', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const fieldsData = await fieldsResponse.json();
  const attrFields = fieldsData.data?.filter(f => f.field.startsWith('attr_'));
  
  console.log('\n=== FIELD VISIBILITY CHECK ===');
  if (attrFields?.length > 0) {
    console.log(`Found ${attrFields.length} attr_ fields`);
    attrFields.forEach(f => {
      console.log(`\n${f.field}:`);
      console.log(`  Hidden: ${f.meta?.hidden}`);
      console.log(`  Width: ${f.meta?.width}`);
      console.log(`  Group: ${f.meta?.group || 'none'}`);
      console.log(`  Conditions: ${f.meta?.conditions ? 'yes' : 'no'}`);
    });
  }
  
  // Check layout preferences
  const preferencesResponse = await fetch('http://localhost:8055/presets?filter[collection][_eq]=products&filter[user][_eq]=' + meData.data?.id, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const preferencesData = await preferencesResponse.json();
  console.log('\n=== LAYOUT PREFERENCES ===');
  console.log('Presets found:', preferencesData.data?.length);
  if (preferencesData.data?.length > 0) {
    const preset = preferencesData.data[0];
    console.log('Layout options:', preset.layout_options);
    console.log('Layout query:', preset.layout_query);
  }
};

testPermissions().catch(console.error);