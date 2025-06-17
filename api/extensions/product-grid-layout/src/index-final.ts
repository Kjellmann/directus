import { defineLayout } from '@directus/extensions-sdk';
import { useCollection, useItems } from '@directus/extensions-sdk';
import { computed, ref, toRefs, watch } from 'vue';
import TabularEnhanced from './tabular-enhanced.vue';

export default defineLayout({
  id: 'product-grid',
  name: 'Product Grid',
  icon: 'grid_view',
  component: TabularEnhanced,
  slots: {
    options: () => null,
    sidebar: () => null,
    actions: () => null
  },
  setup(props, { emit }) {
    const { collection, filter, search } = toRefs(props);
    
    // Get collection info
    const { primaryKeyField, fields: fieldsInCollection, info, sortField } = useCollection(collection);
    
    // Layout state management
    const selection = computed({
      get: () => props.selection || [],
      set: (val) => emit('update:selection', val)
    });
    
    const layoutOptions = computed({
      get: () => props.layoutOptions || {},
      set: (val) => emit('update:layoutOptions', val)
    });
    
    const layoutQuery = computed({
      get: () => props.layoutQuery || {},
      set: (val) => emit('update:layoutQuery', val)
    });
    
    // Query parameters
    const page = computed({
      get: () => layoutQuery.value.page || 1,
      set: (val) => {
        layoutQuery.value = { ...layoutQuery.value, page: val };
      }
    });
    
    const limit = computed({
      get: () => layoutQuery.value.limit || 25,
      set: (val) => {
        layoutQuery.value = { ...layoutQuery.value, limit: val };
      }
    });
    
    const sort = computed({
      get: () => layoutQuery.value.sort || [],
      set: (val) => {
        layoutQuery.value = { ...layoutQuery.value, sort: val };
      }
    });
    
    const fields = computed({
      get: () => {
        const baseFields = layoutQuery.value.fields || ['*'];
        // Always include attributes with full details
        if (!baseFields.includes('*')) {
          const hasAttributes = baseFields.some(f => f.startsWith('attributes'));
          if (!hasAttributes) {
            return [...baseFields, 'attributes.id', 'attributes.product_id', 'attributes.attribute_id.id', 'attributes.attribute_id.code', 'attributes.attribute_id.label', 'attributes.attribute_id.is_searchable', 'attributes.value'];
          }
        }
        return baseFields;
      },
      set: (val) => {
        layoutQuery.value = { ...layoutQuery.value, fields: val };
      }
    });
    
    // Load items with attributes
    const { 
      items, 
      loading, 
      error, 
      totalPages, 
      itemCount, 
      totalCount,
      getItems,
      getItemCount,
      getTotalCount 
    } = useItems(collection, {
      sort,
      limit,
      page,
      fields,
      filter,
      search,
    });
    
    // Table configuration
    const tableHeaders = ref([]);
    const tableSort = computed(() => {
      if (!sort.value?.[0]) {
        return null;
      } else if (sort.value[0].startsWith('-')) {
        return { by: sort.value[0].substring(1), desc: true };
      } else {
        return { by: sort.value[0], desc: false };
      }
    });
    
    // Initialize and refresh
    function refresh() {
      getItems();
      getTotalCount();
      getItemCount();
    }
    
    // Initial load
    refresh();
    
    // Methods
    function toPage(newPage: number) {
      page.value = newPage;
    }
    
    function onSortChange(newSort: { by: string; desc: boolean }) {
      if (!newSort?.by) {
        sort.value = [];
        return;
      }
      
      let sortString = newSort.by;
      if (newSort.desc === true) {
        sortString = '-' + sortString;
      }
      
      sort.value = [sortString];
    }
    
    function onRowClick({ item, event }: any) {
      if (props.readonly) return;
      const primaryKey = item[primaryKeyField.value?.field || 'id'];
      emit('clickRow', { item, event, primaryKey });
    }
    
    function selectAll() {
      if (!primaryKeyField.value || !items.value) return;
      const pk = primaryKeyField.value.field;
      selection.value = items.value.map((item: any) => item[pk]);
    }
    
    // Log for debugging
    watch(items, (newItems) => {
      console.log('[Product Grid Layout] Items loaded:', newItems?.length);
    });
    
    return {
      // Data
      items,
      loading,
      error,
      totalPages,
      itemCount,
      totalCount,
      
      // Table config
      tableHeaders,
      tableSort,
      tableRowHeight: 48,
      
      // Collection info
      collection: collection.value,
      primaryKeyField,
      info,
      fields: fieldsInCollection,
      
      // Methods
      refresh,
      toPage,
      onSortChange,
      onRowClick,
      selectAll,
      
      // Pagination
      page: page.value,
      limit: limit.value,
      
      // Selection
      selection: selection.value,
      showSelect: props.selectMode ? 'multiple' : 'none',
      readonly: props.readonly || false,
      
      // Search/filter
      search: search.value,
      filter: filter.value,
      sortField,
    };
  }
});