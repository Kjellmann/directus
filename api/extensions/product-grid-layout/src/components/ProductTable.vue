<template>
  <div class="product-table-wrapper">
    <!-- Column selector -->
    <v-menu v-model="columnMenuOpen" :close-on-content-click="false">
      <template #activator="{ toggle }">
        <v-button 
          class="add-columns-button" 
          icon 
          small
          @click="toggle"
        >
          <v-icon name="view_column" />
        </v-button>
      </template>
      
      <div class="column-selector">
        <div class="column-selector-header">
          <h3>{{ translate('select_columns') }}</h3>
          <v-input 
            v-model="columnSearch"
            type="search"
            :placeholder="translate('search_columns')"
            prepend-icon="search"
          />
        </div>
        
        <div class="column-groups">
          <!-- Standard fields -->
          <div class="column-group">
            <div class="column-group-header">{{ translate('standard_fields') }}</div>
            <v-checkbox
              v-for="field in filteredStandardFields"
              :key="field.value"
              v-model="selectedColumns"
              :value="field.value"
              :label="field.text"
            />
          </div>
          
          <!-- Attribute fields -->
          <div v-if="filteredAttributeFields.length > 0" class="column-group">
            <div class="column-group-header">{{ translate('attributes') }}</div>
            <v-checkbox
              v-for="field in filteredAttributeFields"
              :key="field.value"
              v-model="selectedColumns"
              :value="field.value"
              :label="field.text"
            />
          </div>
        </div>
        
        <div class="column-selector-footer">
          <v-button secondary @click="resetColumns">
            {{ translate('reset_to_default') }}
          </v-button>
          <v-button @click="applyColumns">
            {{ translate('apply') }}
          </v-button>
        </div>
      </div>
    </v-menu>
    
    <!-- Table -->
    <v-table
      ref="tableRef"
      v-model="selectionWritable"
      v-model:headers="visibleHeaders"
      class="product-table"
      fixed-header
      :show-select="showSelect"
      show-resize
      allow-header-reorder
      @update:headers="onHeadersUpdate"
      :must-sort="tableSort !== null"
      :sort="tableSort || { by: 'date_created', desc: true }"
      :items="items"
      :loading="loading"
      :item-key="primaryKeyField?.field ?? 'id'"
      :clickable="!readonly"
      selection-use-keys
      :row-height="tableRowHeight"
      @click:row="onRowClick"
      @update:sort="onSortChange"
    >
      <template #header-context-menu="{ header }">
        <v-list>
          <v-list-item
            :disabled="header.required || visibleHeaders.length <= 1"
            clickable
            @click="hideColumn(header)"
          >
            <v-list-item-icon>
              <v-icon name="visibility_off" />
            </v-list-item-icon>
            <v-list-item-content>
              {{ translate('hide_field') }}
            </v-list-item-content>
          </v-list-item>
          
          <v-divider />
          
          <v-list-item clickable @click="openColumnSelector">
            <v-list-item-icon>
              <v-icon name="view_column" />
            </v-list-item-icon>
            <v-list-item-content>
              {{ translate('manage_columns') }}
            </v-list-item-content>
          </v-list-item>
        </v-list>
      </template>

      <template v-for="header in visibleHeaders" :key="header.value" #[`item.${header.value}`]="{ item }">
        <render-display
          v-if="!isAttributeField(header.value)"
          :value="item[header.value]"
          :display="header.field?.display || null"
          :options="header.field?.displayOptions || null"
          :interface="header.field?.interface || null"
          :interface-options="header.field?.interfaceOptions || null"
          :type="header.field?.type || 'string'"
          :collection="collection"
          :field="header.value"
        />
        <grid-attribute-value
          v-else
          :value="item[header.value]"
          :attribute="getAttributeForField(header.value)"
        />
      </template>

      <template #footer>
        <div class="footer">
          <div class="pagination">
            <v-pagination
              v-if="totalPages > 1"
              :length="totalPages"
              :total-visible="7"
              show-first-last
              :model-value="page"
              @update:model-value="toPage"
            />
          </div>

          <div v-if="!loading && itemCount && itemCount > 0" class="per-page">
            <span>{{ translate('per_page') }}</span>
            <v-select
              v-model="limitWritable"
              :items="pageSizes"
              inline
            />
          </div>
        </div>
      </template>
    </v-table>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import GridAttributeValue from './GridAttributeValue.vue';

interface Props {
  // Data
  items: any[];
  loading: boolean;
  collection: string;
  
  // Selection
  selection?: any[];
  showSelect?: string;
  readonly: boolean;
  
  // Table config
  tableHeaders: any[];
  tableSort?: { by: string; desc: boolean } | null;
  tableRowHeight: number;
  onRowClick: (event: { item: any; event: PointerEvent }) => void;
  onSortChange: (newSort: { by: string; desc: boolean }) => void;
  
  // Pagination
  page: number;
  toPage: (newPage: number) => void;
  totalPages: number;
  itemCount?: number;
  limit: number;
  
  // Fields
  primaryKeyField?: any;
  availableFields?: any[];
  attributes?: any[];
  
  // Layout options for persistence
  layoutOptions?: any;
}

const props = withDefaults(defineProps<Props>(), {
  selection: () => [],
  showSelect: 'none',
  itemCount: 0,
  tableHeaders: () => [],
  tableSort: null,
  tableRowHeight: 48,
  items: () => [],
  loading: false,
  totalPages: 1,
  page: 1,
  limit: 25,
  readonly: false,
  availableFields: () => [],
  attributes: () => []
});

const emit = defineEmits(['update:selection', 'update:tableHeaders', 'update:limit', 'update:layoutOptions']);

const { t } = useI18n();

// Default translations
const translations = {
  select_columns: 'Select Columns',
  search_columns: 'Search columns...',
  standard_fields: 'Standard Fields',
  attributes: 'Attributes',
  reset_to_default: 'Reset to Default',
  apply: 'Apply',
  hide_field: 'Hide Field',
  manage_columns: 'Manage Columns',
  per_page: 'Per Page'
};

// Use translation with fallback
const translate = (key: string) => {
  try {
    return t(key);
  } catch {
    return translations[key] || key;
  }
};

// State
const tableRef = ref();
const columnMenuOpen = ref(false);
const columnSearch = ref('');
const selectedColumns = ref<string[]>([]);
const isLoadingSavedState = ref(false);
const pageSizes = [25, 50, 100, 250, 500, 1000];

// Sync selection
const selectionWritable = computed({
  get: () => props.selection,
  set: (val) => emit('update:selection', val)
});

// Sync limit
const limitWritable = computed({
  get: () => props.limit,
  set: (val) => emit('update:limit', val)
});

// All available fields
const allAvailableFields = computed(() => {
  const standardFields = [
    { text: 'ID', value: 'id', field: { type: 'string' }, standard: true },
    { text: 'UUID', value: 'uuid', field: { type: 'string' }, standard: true },
    { text: 'Enabled', value: 'enabled', field: { type: 'boolean', interface: 'boolean' }, standard: true },
    { text: 'Product Type', value: 'product_type', field: { type: 'string' }, standard: true },
    { text: 'Family', value: 'family', field: { type: 'integer' }, standard: true },
    { text: 'Created', value: 'date_created', field: { type: 'timestamp', interface: 'datetime' }, standard: true },
    { text: 'Updated', value: 'date_updated', field: { type: 'timestamp', interface: 'datetime' }, standard: true },
  ];
  
  const attributeFields = props.attributes.map(attr => ({
    text: attr.label,
    value: `attr_${attr.code}`,
    field: { type: 'alias' },
    attribute: true
  }));
  
  return [...standardFields, ...attributeFields];
});

// Filtered fields based on search
const filteredStandardFields = computed(() => {
  const search = columnSearch.value.toLowerCase();
  return allAvailableFields.value
    .filter(f => f.standard && f.text.toLowerCase().includes(search));
});

const filteredAttributeFields = computed(() => {
  const search = columnSearch.value.toLowerCase();
  return allAvailableFields.value
    .filter(f => f.attribute && f.text.toLowerCase().includes(search));
});

// Currently visible headers
const visibleHeaders = computed({
  get: () => props.tableHeaders,
  set: (val) => {
    emit('update:tableHeaders', val);
  }
});

// Initialize selected columns from current headers
watch(() => props.tableHeaders, (headers) => {
  if (!isLoadingSavedState.value) {
    selectedColumns.value = headers.map(h => h.value);
  }
}, { immediate: true });

// Load saved state only once on mount
onMounted(() => {
  if (props.layoutOptions?.savedColumns?.length > 0) {
    isLoadingSavedState.value = true;
    selectedColumns.value = props.layoutOptions.savedColumns;
    applySavedColumns();
    // Reset flag after a delay
    setTimeout(() => {
      isLoadingSavedState.value = false;
    }, 500);
  }
});

// Methods
const isAttributeField = (field: string) => field.startsWith('attr_');

const getAttributeForField = (field: string) => {
  if (!isAttributeField(field)) return null;
  const code = field.replace('attr_', '');
  return props.attributes.find(a => a.code === code);
};

const hideColumn = (header: any) => {
  const newHeaders = visibleHeaders.value.filter(h => h.value !== header.value);
  visibleHeaders.value = newHeaders;
  selectedColumns.value = newHeaders.map(h => h.value);
  
  // Save the state
  saveColumnState();
};

const openColumnSelector = () => {
  columnMenuOpen.value = true;
};

const resetColumns = () => {
  // Default columns
  selectedColumns.value = ['id', 'enabled', 'date_created'];
  
  // Clear saved state
  emit('update:layoutOptions', {
    ...props.layoutOptions,
    savedColumns: null,
    columnWidths: null
  });
  
  applyColumns();
};

const onHeadersUpdate = (newHeaders: any[]) => {
  console.log('[ProductTable] Headers updated (reorder/resize):', newHeaders);
  
  // Update our headers
  visibleHeaders.value = newHeaders;
  
  // Save the new state (including new widths and order) with debounce
  if (!isLoadingSavedState.value) {
    setTimeout(() => {
      saveColumnState();
    }, 300);
  }
};

const applyColumns = () => {
  const newHeaders = selectedColumns.value
    .map(col => {
      const field = allAvailableFields.value.find(f => f.value === col);
      if (!field) return null;
      
      // Check if we have saved widths
      const savedWidth = props.layoutOptions?.columnWidths?.[col] || 150;
      
      return {
        text: field.text,
        value: field.value,
        width: savedWidth,
        align: 'left',
        sortable: !['json', 'alias'].includes(field.field?.type || ''),
        field: field.field
      };
    })
    .filter(h => h !== null);
  
  visibleHeaders.value = newHeaders;
  columnMenuOpen.value = false;
  
  // Save the column configuration
  saveColumnState();
};

const applySavedColumns = () => {
  if (!props.layoutOptions?.savedColumns) return;
  
  const newHeaders = props.layoutOptions.savedColumns
    .map(col => {
      const field = allAvailableFields.value.find(f => f.value === col);
      if (!field) return null;
      
      const savedWidth = props.layoutOptions?.columnWidths?.[col] || 150;
      
      return {
        text: field.text,
        value: field.value,
        width: savedWidth,
        align: 'left',
        sortable: !['json', 'alias'].includes(field.field?.type || ''),
        field: field.field
      };
    })
    .filter(h => h !== null);
  
  if (newHeaders.length > 0) {
    // Don't trigger saves while loading
    isLoadingSavedState.value = true;
    visibleHeaders.value = newHeaders;
    setTimeout(() => {
      isLoadingSavedState.value = false;
    }, 100);
  }
};

const saveColumnState = () => {
  // Prevent saving if we're in the process of loading saved state
  if (isLoadingSavedState.value) return;
  
  const columnOrder = visibleHeaders.value.map(h => h.value);
  const columnWidths = {};
  
  visibleHeaders.value.forEach(header => {
    if (header.width) {
      columnWidths[header.value] = header.width;
    }
  });
  
  // Only emit if the state has actually changed
  const currentSaved = props.layoutOptions?.savedColumns || [];
  const currentWidths = props.layoutOptions?.columnWidths || {};
  
  const columnsChanged = JSON.stringify(columnOrder) !== JSON.stringify(currentSaved);
  const widthsChanged = JSON.stringify(columnWidths) !== JSON.stringify(currentWidths);
  
  if (columnsChanged || widthsChanged) {
    emit('update:layoutOptions', {
      ...props.layoutOptions,
      savedColumns: columnOrder,
      columnWidths: columnWidths
    });
  }
};
</script>

<style scoped>
.product-table-wrapper {
  position: relative;
  height: 100%;
}

.add-columns-button {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
}

.product-table {
  --v-table-sticky-offset-top: var(--layout-offset-top);
}

.column-selector {
  min-width: 300px;
  max-width: 400px;
  max-height: 600px;
  display: flex;
  flex-direction: column;
  background: var(--background-page);
  border-radius: var(--border-radius);
}

.column-selector-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-subdued);
}

.column-selector-header h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
}

.column-groups {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.column-group {
  margin-bottom: 24px;
}

.column-group:last-child {
  margin-bottom: 0;
}

.column-group-header {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--foreground-subdued);
  margin-bottom: 8px;
}

.column-group .v-checkbox {
  display: block;
  margin-bottom: 8px;
}

.column-selector-footer {
  padding: 16px;
  border-top: 1px solid var(--border-subdued);
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.footer {
  position: sticky;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 32px;
}

.pagination {
  display: inline-block;
}

.per-page {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--foreground-subdued);
}

.per-page span {
  width: max-content;
}
</style>