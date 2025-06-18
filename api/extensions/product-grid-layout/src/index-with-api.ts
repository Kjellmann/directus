import { defineLayout } from '@directus/extensions-sdk';
import { useCollection } from '@directus/extensions-sdk';
import { computed, ref, toRefs, watch, inject } from 'vue';
import TabularEnhanced from './tabular-enhanced-v2.vue';
import ProductGridOptions from './options.vue';
import { useProductClickHandler } from './composables/use-product-click-handler';

export default defineLayout({
  id: 'product-grid',
  name: 'Product Grid', // Unfortunately, can't use dynamic translations here
  icon: 'grid_view',
  component: TabularEnhanced,
  slots: {
    options: ProductGridOptions,
    sidebar: () => null,
    actions: () => null
  },
  setup(props, { emit }) {
    const { collection, filter, search } = toRefs(props);
    const api = inject('api') as any;
    
    // Get collection info
    const { primaryKeyField, fields: fieldsInCollection, info, sortField } = useCollection(collection);
    
    // State
    const items = ref([]);
    const loading = ref(false);
    const error = ref(null);
    const totalPages = ref(1);
    const itemCount = ref(0);
    const totalCount = ref(0);
    
    // Layout state management
    const selection = computed({
      get: () => props.selection || [],
      set: (val) => emit('update:selection', val)
    });
    
    const layoutOptions = computed({
      get: () => {
        const options = props.layoutOptions || {};
        return {
          spacing: options.spacing || 'cozy',
          viewMode: options.viewMode || 'list',
          ...options
        };
      },
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
    
    // Load items using our custom API
    async function loadItems() {
      if (collection.value !== 'products') {
        console.warn('[Product Grid] This layout only works with products collection');
        return;
      }
      
      loading.value = true;
      error.value = null;
      
      try {
        const params = {
          page: page.value,
          limit: limit.value,
          sort: sort.value?.[0] || '-date_created',
          search: search.value || '',
          filter: filter.value ? JSON.stringify(filter.value) : undefined
        };
        
        const response = await api.get('/product-grid/products', { params });
        
        items.value = response.data.data || [];
        totalCount.value = response.data.meta?.total_count || 0;
        itemCount.value = totalCount.value;
        totalPages.value = Math.ceil(totalCount.value / limit.value);
      } catch (err) {
        console.error('[Product Grid] Error loading items:', err);
        error.value = err;
        items.value = [];
      } finally {
        loading.value = false;
      }
    }
    
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
    
    // Layout configuration
    const spacing = computed({
      get: () => layoutOptions.value.spacing || 'cozy',
      set: (val) => {
        layoutOptions.value = { ...layoutOptions.value, spacing: val };
      }
    });
    
    const viewMode = computed({
      get: () => layoutOptions.value.viewMode || 'list',
      set: (val) => {
        layoutOptions.value = { ...layoutOptions.value, viewMode: val };
      }
    });
    
    const tableRowHeight = computed(() => {
      switch (spacing.value) {
        case 'compact':
          return 32;
        case 'cozy':
        default:
          return 80;
        case 'comfortable':
          return 64;
      }
    });
    
    // Initialize and refresh
    function refresh() {
      loadItems();
    }
    
    // Watch for changes
    watch([page, limit, sort, filter, search], () => {
      loadItems();
    });
    
    // Initial load
    loadItems();
    
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
    
    // Use the Directus-style click handler
    const { onClick: onRowClick } = useProductClickHandler(
      collection,
      primaryKeyField,
      selection,
      props.selectMode || false,
      props.readonly || false
    );
    
    function selectAll() {
      if (!primaryKeyField.value || !items.value) return;
      const pk = primaryKeyField.value.field;
      selection.value = items.value.map((item: any) => item[pk]);
    }
    
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
      tableRowHeight,
      spacing,
      viewMode,
      
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
      page,
      limit,
      
      // Selection
      selection,
      showSelect: props.selectMode ? 'multiple' : 'none',
      readonly: props.readonly || false,
      
      // Search/filter
      search,
      filter,
      sortField,
      
      // Flag to indicate we're using the API
      useCustomApi: true,
      
      // Layout options for persistence
      layoutOptions
    };
  }
});