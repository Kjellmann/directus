<template>
  <component
    :is="layoutComponent"
    v-bind="layoutProps"
    @update:selection="$emit('update:selection', $event)"
    @update:tableHeaders="$emit('update:tableHeaders', $event)"
    @update:limit="$emit('update:limit', $event)"
  />
</template>

<script setup>
import { computed } from 'vue';
import TabularEnhanced from './tabular-enhanced.vue';

// Define props that will be passed from the layout system
const props = defineProps({
  items: Array,
  loading: Boolean,
  error: Object,
  itemCount: Number,
  totalPages: Number,
  collection: String,
  primaryKeyField: Object,
  info: Object,
  fields: Array,
  selection: Array,
  showSelect: String,
  readonly: Boolean,
  tableHeaders: Array,
  tableSort: Object,
  tableRowHeight: Number,
  page: Number,
  limit: Number,
  toPage: Function,
  onRowClick: Function,
  onSortChange: Function,
  search: String,
  filter: Object,
  refresh: Function,
  selectAll: Function,
});

// The component to render
const layoutComponent = TabularEnhanced;

// Pass through all the props that our enhanced table needs
const layoutProps = computed(() => ({
  // Items and data
  items: props.items || [],
  loading: props.loading || false,
  error: props.error,
  itemCount: props.itemCount || 0,
  totalPages: props.totalPages || 1,
  
  // Collection info
  collection: props.collection,
  primaryKeyField: props.primaryKeyField,
  info: props.info,
  fields: props.fields || [],
  
  // Selection
  selection: props.selection || [],
  showSelect: props.showSelect || 'none',
  readonly: props.readonly || false,
  
  // Table config
  tableHeaders: props.tableHeaders || [],
  tableSort: props.tableSort || null,
  tableRowHeight: props.tableRowHeight || 48,
  
  // Pagination
  page: props.page || 1,
  limit: props.limit || 25,
  toPage: props.toPage || (() => {}),
  
  // Events
  onRowClick: props.onRowClick || (() => {}),
  onSortChange: props.onSortChange || (() => {}),
  
  // Search/Filter
  search: props.search || '',
  filter: props.filter || null,
  
  // Methods
  refresh: refresh || (() => {}),
  selectAll: selectAll || (() => {}),
}));

// Debug logging
console.log('[Product Grid Wrapper] Props:', props);
console.log('[Product Grid Wrapper] Items:', props?.items?.length);
</script>