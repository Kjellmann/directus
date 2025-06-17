import { defineLayout } from '@directus/extensions-sdk';
import { computed } from 'vue';
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
    // The layout must return the proper data structure
    // that the parent expects from layouts
    return {
      // Pass through all props
      collection: props.collection,
      selection: props.selection,
      layoutOptions: props.layoutOptions,
      layoutQuery: props.layoutQuery,
      filter: props.filter,
      filterSystem: props.filterSystem,
      filterUser: props.filterUser,
      search: props.search,
      readonly: props.readonly || false,
      selectMode: props.selectMode || false,
      
      // These will be provided by the parent
      items: props.items || [],
      loading: props.loading || false,
      error: props.error || null,
      totalPages: props.totalPages || 1,
      itemCount: props.itemCount || 0,
      totalCount: props.totalCount || 0,
      page: props.layoutQuery?.page || 1,
      limit: props.layoutQuery?.limit || 25,
      primaryKeyField: props.primaryKeyField,
      fields: props.fields || [],
      info: props.info,
      sortField: props.sortField,
      
      // Table specific props
      tableHeaders: [],
      tableSort: computed(() => {
        const sort = props.layoutQuery?.sort?.[0];
        if (!sort) return null;
        if (sort.startsWith('-')) {
          return { by: sort.substring(1), desc: true };
        }
        return { by: sort, desc: false };
      }),
      tableRowHeight: 48,
      showSelect: props.selectMode ? 'multiple' : 'none',
      
      // Methods
      onRowClick: ({ item, event }) => {
        if (props.readonly) return;
        const primaryKey = item[props.primaryKeyField?.field || 'id'];
        emit('clickRow', { item, event, primaryKey });
      },
      
      onSortChange: (newSort) => {
        if (!newSort?.by) {
          emit('update:layoutQuery', { ...props.layoutQuery, sort: [] });
          return;
        }
        
        let sortString = newSort.by;
        if (newSort.desc === true) {
          sortString = '-' + sortString;
        }
        
        emit('update:layoutQuery', { ...props.layoutQuery, sort: [sortString] });
      },
      
      toPage: (newPage) => {
        emit('update:layoutQuery', { ...props.layoutQuery, page: newPage });
      },
      
      refresh: () => {
        // Parent will handle refresh
        emit('refresh');
      },
      
      selectAll: () => {
        if (!props.primaryKeyField || !props.items) return;
        const pk = props.primaryKeyField.field;
        emit('update:selection', props.items.map((item) => item[pk]));
      }
    };
  }
});