const testProductAttrs = async () => {
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
  
  // First check if there are any products
  const productsResp = await fetch('http://localhost:8055/items/products?limit=5', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const products = await productsResp.json();
  console.log('=== PRODUCTS ===');
  console.log('Total:', products.data?.length || 0);
  
  if (products.data?.length > 0) {
    // Check product_attributes table
    const productId = products.data[0].id;
    console.log('\nChecking attributes for product:', productId);
    
    const attrResp = await fetch(`http://localhost:8055/items/product_attributes?filter[product_id][_eq]=${productId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const attrs = await attrResp.json();
    console.log('\n=== PRODUCT ATTRIBUTES ===');
    console.log('Count:', attrs.data?.length || 0);
    
    if (attrs.data?.length > 0) {
      console.log('\nSample attribute value:');
      console.log(JSON.stringify(attrs.data[0], null, 2));
    }
    
    // Now test the field values
    const productWithAttrs = await fetch(`http://localhost:8055/items/products/${productId}?fields=*,attr_name,attr_sku,attr_price`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const productData = await productWithAttrs.json();
    console.log('\n=== PRODUCT WITH VIRTUAL FIELDS ===');
    console.log('Status:', productWithAttrs.status);
    console.log('Response:', JSON.stringify(productData, null, 2));
  }
};

testProductAttrs().catch(console.error);