const testPermissionsFields = async () => {
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
  
  // Get current user info
  const meResp = await fetch('http://localhost:8055/users/me', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const me = await meResp.json();
  console.log('=== CURRENT USER ===');
  console.log('ID:', me.data?.id);
  console.log('Role:', me.data?.role);
  
  // Get role details
  if (me.data?.role) {
    const roleResp = await fetch(`http://localhost:8055/roles/${me.data.role}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const role = await roleResp.json();
    console.log('\n=== ROLE DETAILS ===');
    console.log('Name:', role.data?.name);
    console.log('Admin Access:', role.data?.admin_access);
  }
  
  // Check permissions for products collection
  const permsResp = await fetch(`http://localhost:8055/permissions?filter[collection][_eq]=products&filter[role][_eq]=${me.data?.role}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const perms = await permsResp.json();
  console.log('\n=== PRODUCTS PERMISSIONS ===');
  console.log('Count:', perms.data?.length || 0);
  
  if (perms.data?.length > 0) {
    perms.data.forEach(perm => {
      console.log(`\nAction: ${perm.action}`);
      console.log('Fields:', perm.fields);
      console.log('Validation:', perm.validation);
    });
  }
  
  // Test with just standard fields
  const productResp = await fetch('http://localhost:8055/items/products?limit=1&fields=id,uuid', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const products = await productResp.json();
  console.log('\n=== STANDARD FIELDS TEST ===');
  console.log('Status:', productResp.status);
  console.log('Data:', JSON.stringify(products.data, null, 2));
};

testPermissionsFields().catch(console.error);