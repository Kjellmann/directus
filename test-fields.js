fetch('http://localhost:8055/fields/products')
  .then(res => res.json())
  .then(data => {
    const fields = data.data || [];
    console.log('Total fields:', fields.length);
    
    const attrFields = fields.filter(f => f.field.startsWith('attr_'));
    console.log('Attribute fields found:', attrFields.length);
    
    if (attrFields.length > 0) {
      console.log('\nAttribute fields:');
      attrFields.forEach(f => {
        console.log(`  - ${f.field} (interface: ${f.meta?.interface}, hidden: ${f.meta?.hidden})`);
      });
    } else {
      console.log('\nNo attr_ fields found!');
      console.log('All fields:', fields.map(f => f.field));
    }
  })
  .catch(err => console.error('Error:', err));