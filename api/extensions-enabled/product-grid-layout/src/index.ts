import { defineLayout } from '@directus/extensions-sdk';
import { useCollection, useItems, useSync } from '@directus/composables';
import { computed, ref, toRefs } from 'vue';
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
    const { primaryKeyField, fields: fieldsInCollection, info } = useCollection(collection);
    
    // Sync with parent
    const selection = useSync(props, 'selection', emit);
    const layoutOptions = useSync(props, 'layoutOptions', emit);
    const layoutQuery = useSync(props, 'layoutQuery', emit);
    
    // Default values for layoutQuery
    if (!layoutQuery.value) {
      layoutQuery.value = {};
    }
    
    // Reactive values for pagination, sorting, etc.
    const page = computed({
      get: () => layoutQuery.value?.page || 1,
      set: (val) => {
        layoutQuery.value = { ...layoutQuery.value, page: val };
      }
    });
    
    const limit = computed({
      get: () => layoutQuery.value?.limit || 25,
      set: (val) => {
        layoutQuery.value = { ...layoutQuery.value, limit: val };
      }
    });
    
    const sort = computed({
      get: () => layoutQuery.value?.sort || [],
      set: (val) => {
        layoutQuery.value = { ...layoutQuery.value, sort: val };
      }
    });
    
    const fields = computed({
      get: () => layoutQuery.value?.fields || ['*'],
      set: (val) => {
        layoutQuery.value = { ...layoutQuery.value, fields: val };
      }
    });
    
    // Load items using Directus useItems composable
    const {
      items,
      loading,
      error,
      totalPages,
      itemCount,
      totalCount,
      getItems,
      getItemCount,
      getTotalCount,
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
    
    // Load initial data
    refresh();
    
    function refresh() {
      console.log('[Product Grid] Refreshing data...');
      getItems();
      getTotalCount();
      getItemCount();
    }
    
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
      const primaryKey = item[primaryKeyField.value?.field || 'id'];
      emit('clickRow', { item, event, primaryKey });
    }
    
    function selectAll() {
      if (!primaryKeyField.value || !items.value) return;
      const pk = primaryKeyField.value.field;
      selection.value = items.value.map((item: any) => item[pk]);
    }
    
    console.log('[Product Grid] Setup complete, items:', items.value?.length);
    
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
      selection,
      showSelect: props.selectMode ? 'multiple' : 'none',
      readonly: props.readonly || false,
      
      // Search/filter
      search: search.value,
      filter: filter.value,
    };
  }
});