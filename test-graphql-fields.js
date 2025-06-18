// Using native fetch in Node.js 18+

const testGraphQLFields = async () => {
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
  
  // Test GraphQL schema introspection
  const introspectionQuery = `
    query IntrospectionQuery {
      __type(name: "products") {
        name
        fields {
          name
          type {
            name
            kind
          }
          description
        }
      }
    }
  `;
  
  const graphqlResponse = await fetch('http://localhost:8055/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      query: introspectionQuery
    })
  });
  
  const graphqlData = await graphqlResponse.json();
  
  console.log('=== GRAPHQL SCHEMA ===');
  if (graphqlData.data?.__type) {
    const fields = graphqlData.data.__type.fields || [];
    const attrFields = fields.filter(f => f.name.startsWith('attr_'));
    
    console.log('Total fields:', fields.length);
    console.log('Attribute fields:', attrFields.length);
    
    if (attrFields.length > 0) {
      console.log('\nAttribute fields in GraphQL:');
      attrFields.forEach(f => {
        console.log(`- ${f.name} (${f.type?.name || 'unknown type'})`);
      });
    } else {
      console.log('\nNo attribute fields found in GraphQL schema!');
      console.log('Sample fields:', fields.slice(0, 5).map(f => f.name));
    }
  } else {
    console.log('GraphQL type not found or error:', graphqlData);
  }
  
  // Also test a direct GraphQL query
  const productsQuery = `
    query {
      products(limit: 1) {
        id
        attr_name
        attr_sku
        attr_price
      }
    }
  `;
  
  const queryResponse = await fetch('http://localhost:8055/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      query: productsQuery
    })
  });
  
  const queryData = await queryResponse.json();
  console.log('\n=== GRAPHQL QUERY TEST ===');
  console.log('Query result:', JSON.stringify(queryData, null, 2));
};

testGraphQLFields().catch(console.error);