const testAuthFields = async () => {
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
  console.log('Login status:', loginResponse.status);
  
  if (!loginData.data?.access_token) {
    console.error('No access token received');
    return;
  }
  
  // Now fetch fields
  const fieldsResponse = await fetch('http://localhost:8055/fields/products', {
    headers: {
      'Authorization': `Bearer ${loginData.data.access_token}`
    }
  });
  
  const fieldsData = await fieldsResponse.json();
  console.log('Fields response status:', fieldsResponse.status);
  
  if (fieldsData.data) {
    console.log('Total fields:', fieldsData.data.length);
    const attrFields = fieldsData.data.filter(f => f.field.startsWith('attr_'));
    console.log('Attribute fields:', attrFields.length);
    
    if (attrFields.length > 0) {
      console.log('\nFound attribute fields:');
      attrFields.forEach(f => {
        console.log(`  - ${f.field} (type: ${f.type}, interface: ${f.meta?.interface})`);
      });
    }
  }
};

testAuthFields().catch(console.error);