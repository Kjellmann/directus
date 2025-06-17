import { defineLayout } from '@directus/extensions-sdk';
import { useCollection, useItems } from '@directus/extensions-sdk';
import { computed, toRefs } from 'vue';
import SimpleGrid from './simple-grid.vue';

export default defineLayout({
  id: 'product-grid',
  name: 'Product Grid',
  icon: 'grid_view',
  component: SimpleGrid,
  slots: {
    options: () => null,
    sidebar: () => null,
    actions: () => null
  },
  setup(props, { emit }) {
    const { collection, filter, search } = toRefs(props);
    
    // Get collection info
    const { primaryKeyField } = useCollection(collection);
    
    // Layout query management
    const layoutQuery = computed({
      get: () => props.layoutQuery || {},
      set: (newQuery) => emit('update:layoutQuery', newQuery)
    });
    
    const page = computed({
      get: () => layoutQuery.value.page || 1,
      set: (newPage) => {
        layoutQuery.value = { ...layoutQuery.value, page: newPage };
      }
    });
    
    const limit = computed({
      get: () => layoutQuery.value.limit || 25,
      set: (newLimit) => {
        layoutQuery.value = { ...layoutQuery.value, limit: newLimit };
      }
    });
    
    const sort = computed({
      get: () => layoutQuery.value.sort || [],
      set: (newSort) => {
        layoutQuery.value = { ...layoutQuery.value, sort: newSort };
      }
    });
    
    const fields = computed({
      get: () => {
        const baseFields = layoutQuery.value.fields || ['*'];
        // Always include attributes
        if (!baseFields.includes('*') && !baseFields.includes('attributes')) {
          return [...baseFields, 'attributes.*'];
        }
        return baseFields;
      },
      set: (newFields) => {
        layoutQuery.value = { ...layoutQuery.value, fields: newFields };
      }
    });
    
    // Load items
    const { items, loading, error, getItems } = useItems(collection, {
      sort,
      limit,
      page,
      fields,
      filter,
      search,
    });
    
    // Initial load
    getItems();
    
    console.log('[Product Grid Test] Setup complete');
    
    return {
      items,
      loading,
      error,
      collection: collection.value,
      primaryKeyField,
    };
  }
});