<template>
  <div class="product-grid-layout">
    <!-- Header with actions -->
    <div class="layout-header">
      <div class="layout-title">
        <h2>{{ collection === 'products' ? 'Products' : collection }}</h2>
        <div class="item-count" v-if="!loading">
          {{ totalCount }} {{ totalCount === 1 ? 'item' : 'items' }}
        </div>
      </div>
      
      <div class="layout-actions">
        <v-button @click="showColumnSelector = true" icon secondary>
          <v-icon name="view_column" />
        </v-button>
        <v-button @click="showFilterPanel = !showFilterPanel" icon secondary>
          <v-icon name="filter_list" />
          <span v-if="activeFilters.length > 0" class="filter-count">{{ activeFilters.length }}</span>
        </v-button>
        <v-button @click="exportData" icon secondary>
          <v-icon name="download" />
        </v-button>
        <v-button @click="refresh" icon secondary>
          <v-icon name="refresh" />
        </v-button>
      </div>
    </div>

    <!-- Filter Panel -->
    <transition name="slide">
      <div v-if="showFilterPanel" class="filter-panel">
        <div class="filter-header">
          <h3>Filters</h3>
          <v-button @click="clearAllFilters" x-small secondary v-if="activeFilters.length > 0">
            Clear All
          </v-button>
        </div>
        
        <!-- Standard field filters -->
        <div class="filter-section">
          <h4>Product Fields</h4>
          <div class="filter-item" v-for="field in standardFields" :key="field.field">
            <label>{{ field.name }}</label>
            <v-input
              v-if="field.type === 'string'"
              v-model="filters[field.field]"
              :placeholder="`Filter by ${field.name}...`"
              @input="applyFilters"
            />
            <v-select
              v-else-if="field.type === 'boolean'"
              v-model="filters[field.field]"
              :items="[
                { text: 'All', value: null },
                { text: 'Yes', value: true },
                { text: 'No', value: false }
              ]"
              @update:model-value="applyFilters"
            />
          </div>
        </div>
        
        <!-- Attribute filters -->
        <div class="filter-section" v-if="availableAttributes.length > 0">
          <h4>Attributes</h4>
          <div class="filter-item" v-for="attr in availableAttributes" :key="attr.code">
            <label>{{ attr.label }}</label>
            <v-input
              v-if="['text', 'identifier'].includes(attr.type.input_interface)"
              v-model="attributeFilters[attr.code]"
              :placeholder="`Filter by ${attr.label}...`"
              @input="applyFilters"
            />
            <v-select
              v-else-if="attr.type.input_interface === 'simple_select'"
              v-model="attributeFilters[attr.code]"
              :items="[
                { text: 'All', value: null },
                ...getAttributeOptions(attr)
              ]"
              @update:model-value="applyFilters"
            />
            <div 
              v-else-if="['number', 'price'].includes(attr.type.input_interface)"
              class="range-filter"
            >
              <v-input
                v-model.number="attributeFilters[`${attr.code}_min`]"
                type="number"
                placeholder="Min"
                @input="applyFilters"
              />
              <span>-</span>
              <v-input
                v-model.number="attributeFilters[`${attr.code}_max`]"
                type="number"
                placeholder="Max"
                @input="applyFilters"
              />
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- Main Grid -->
    <div class="layout-content" :class="{ 'with-filter': showFilterPanel }">
      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <v-progress-circular />
        <p>Loading products...</p>
      </div>

      <!-- Data Table -->
      <div v-else-if="items.length > 0" class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th class="checkbox-column">
                <v-checkbox
                  :model-value="allSelected"
                  @update:model-value="toggleSelectAll"
                />
              </th>
              <th 
                v-for="column in visibleColumns" 
                :key="column.field"
                @click="toggleSort(column.field)"
                :class="{ sortable: column.sortable, sorted: sortField === column.field }"
              >
                {{ column.name }}
                <v-icon 
                  v-if="column.sortable" 
                  :name="getSortIcon(column.field)"
                  small
                />
              </th>
              <th class="actions-column">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="item in items" 
              :key="item.id"
              @click="selectItem(item)"
              :class="{ selected: selectedItems.includes(item.id) }"
            >
              <td class="checkbox-column" @click.stop>
                <v-checkbox
                  :model-value="selectedItems.includes(item.id)"
                  @update:model-value="toggleItemSelection(item.id)"
                />
              </td>
              <td v-for="column in visibleColumns" :key="column.field">
                <div class="cell-content">
                  <!-- Standard fields -->
                  <template v-if="!column.isAttribute">
                    <span v-if="column.type === 'boolean'">
                      <v-icon :name="item[column.field] ? 'check' : 'close'" />
                    </span>
                    <span v-else-if="column.type === 'datetime'">
                      {{ formatDate(item[column.field]) }}
                    </span>
                    <span v-else>
                      {{ item[column.field] || '-' }}
                    </span>
                  </template>
                  
                  <!-- Attribute fields -->
                  <template v-else>
                    <attribute-value 
                      :value="getAttributeValue(item, column.field)"
                      :attribute="column.attribute"
                    />
                  </template>
                </div>
              </td>
              <td class="actions-column" @click.stop>
                <v-menu placement="bottom-end" show-arrow>
                  <template #activator="{ toggle }">
                    <v-button @click="toggle" icon x-small>
                      <v-icon name="more_vert" />
                    </v-button>
                  </template>
                  <v-list>
                    <v-list-item @click="editItem(item)">
                      <v-list-item-icon><v-icon name="edit" /></v-list-item-icon>
                      <v-list-item-content>Edit</v-list-item-content>
                    </v-list-item>
                    <v-list-item @click="duplicateItem(item)">
                      <v-list-item-icon><v-icon name="content_copy" /></v-list-item-icon>
                      <v-list-item-content>Duplicate</v-list-item-content>
                    </v-list-item>
                    <v-list-item @click="deleteItem(item)" class="danger">
                      <v-list-item-icon><v-icon name="delete" /></v-list-item-icon>
                      <v-list-item-content>Delete</v-list-item-content>
                    </v-list-item>
                  </v-list>
                </v-menu>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state">
        <v-icon name="inventory_2" large />
        <p>No products found</p>
        <v-button @click="clearAllFilters" v-if="hasFilters">
          Clear Filters
        </v-button>
      </div>

      <!-- Pagination -->
      <div class="pagination" v-if="totalPages > 1">
        <v-pagination
          :model-value="page"
          :total-pages="totalPages"
          @update:model-value="setPage"
        />
      </div>
    </div>

    <!-- Column Selector Dialog -->
    <v-dialog 
      v-model="showColumnSelector" 
      title="Select Columns"
      @cancel="showColumnSelector = false"
    >
      <div class="column-selector">
        <div class="column-section">
          <h4>Product Fields</h4>
          <v-checkbox
            v-for="field in standardFields"
            :key="field.field"
            :model-value="selectedColumns.includes(field.field)"
            @update:model-value="toggleColumn(field.field)"
            :label="field.name"
          />
        </div>
        
        <div class="column-section" v-if="availableAttributes.length > 0">
          <h4>Attributes</h4>
          <v-checkbox
            v-for="attr in availableAttributes"
            :key="`attr_${attr.code}`"
            :model-value="selectedColumns.includes(`attr_${attr.code}`)"
            @update:model-value="toggleColumn(`attr_${attr.code}`)"
            :label="attr.label"
          />
        </div>
      </div>
      
      <template #actions>
        <v-button @click="showColumnSelector = false" secondary>
          Cancel
        </v-button>
        <v-button @click="saveColumnSelection">
          Apply
        </v-button>
      </template>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useApi, useStores } from '@directus/extensions-sdk';
import { useRouter } from 'vue-router';
import { debounce } from 'lodash-es';
import AttributeValue from './components/AttributeValue.vue';

interface Props {
  collection: string;
  selection?: string[];
  layout?: string;
  search?: string;
  filter?: Record<string, any>;
  limit?: number;
}

const props = withDefaults(defineProps<Props>(), {
  collection: 'products',
  selection: () => [],
  limit: 25
});

const emit = defineEmits(['update:selection', 'update:layout']);

const api = useApi();
const router = useRouter();
const { useNotificationsStore } = useStores();
const notifications = useNotificationsStore();

// State
const loading = ref(false);
const items = ref<any[]>([]);
const totalCount = ref(0);
const page = ref(1);
const selectedItems = ref<string[]>([]);
const showFilterPanel = ref(false);
const showColumnSelector = ref(false);
const sortField = ref<string | null>(null);
const sortDirection = ref<'asc' | 'desc'>('asc');

// Filters
const filters = ref<Record<string, any>>({});
const attributeFilters = ref<Record<string, any>>({});

// Columns
const standardFields = ref<any[]>([
  { field: 'id', name: 'ID', type: 'uuid', sortable: true },
  { field: 'enabled', name: 'Enabled', type: 'boolean', sortable: true },
  { field: 'date_created', name: 'Created', type: 'datetime', sortable: true },
  { field: 'date_updated', name: 'Updated', type: 'datetime', sortable: true }
]);

const availableAttributes = ref<any[]>([]);
const selectedColumns = ref<string[]>(['id', 'enabled', 'date_created']);

// Computed
const totalPages = computed(() => Math.ceil(totalCount.value / props.limit));

const hasFilters = computed(() => {
  return Object.values(filters.value).some(v => v !== null && v !== '') ||
         Object.values(attributeFilters.value).some(v => v !== null && v !== '');
});

const activeFilters = computed(() => {
  const active = [];
  
  Object.entries(filters.value).forEach(([field, value]) => {
    if (value !== null && value !== '') {
      active.push({ field, value, type: 'standard' });
    }
  });
  
  Object.entries(attributeFilters.value).forEach(([field, value]) => {
    if (value !== null && value !== '') {
      active.push({ field, value, type: 'attribute' });
    }
  });
  
  return active;
});

const visibleColumns = computed(() => {
  return selectedColumns.value.map(field => {
    if (field.startsWith('attr_')) {
      const code = field.replace('attr_', '');
      const attr = availableAttributes.value.find(a => a.code === code);
      return {
        field,
        name: attr?.label || code,
        type: 'attribute',
        sortable: true,
        isAttribute: true,
        attribute: attr
      };
    } else {
      const standardField = standardFields.value.find(f => f.field === field);
      return {
        field,
        name: standardField?.name || field,
        type: standardField?.type || 'string',
        sortable: standardField?.sortable || false,
        isAttribute: false
      };
    }
  });
});

const allSelected = computed(() => {
  return items.value.length > 0 && items.value.every(item => selectedItems.value.includes(item.id));
});

// Methods
const loadData = async () => {
  loading.value = true;
  
  try {
    // Build query
    const query: any = {
      limit: props.limit,
      offset: (page.value - 1) * props.limit,
      meta: 'total_count'
    };
    
    // Add search
    if (props.search) {
      query.search = props.search;
    }
    
    // Add filters
    const filterQuery: any = {};
    
    // Standard filters
    Object.entries(filters.value).forEach(([field, value]) => {
      if (value !== null && value !== '') {
        if (typeof value === 'string') {
          filterQuery[field] = { _contains: value };
        } else {
          filterQuery[field] = { _eq: value };
        }
      }
    });
    
    // Attribute filters - these need special handling
    const attrFilters = Object.entries(attributeFilters.value)
      .filter(([_, value]) => value !== null && value !== '');
    
    if (attrFilters.length > 0) {
      // We'll handle this in the API endpoint
      query.attribute_filters = JSON.stringify(Object.fromEntries(attrFilters));
    }
    
    if (Object.keys(filterQuery).length > 0) {
      query.filter = filterQuery;
    }
    
    // Add sort
    if (sortField.value) {
      query.sort = `${sortDirection.value === 'desc' ? '-' : ''}${sortField.value}`;
    }
    
    // Load products
    const response = await api.get('/items/products', { params: query });
    
    items.value = response.data.data || [];
    totalCount.value = response.data.meta?.total_count || 0;
    
    // Load attribute values for the products
    if (items.value.length > 0) {
      await loadAttributeValues();
    }
  } catch (error) {
    console.error('Error loading data:', error);
    notifications.add({
      title: 'Error loading products',
      type: 'error'
    });
  } finally {
    loading.value = false;
  }
};

const loadAttributeValues = async () => {
  const productIds = items.value.map(item => item.id);
  const attributeCodes = selectedColumns.value
    .filter(col => col.startsWith('attr_'))
    .map(col => col.replace('attr_', ''));
  
  if (attributeCodes.length === 0) return;
  
  try {
    // Get attribute IDs
    const attrResponse = await api.get('/items/attributes', {
      params: {
        filter: { code: { _in: attributeCodes } },
        fields: ['id', 'code']
      }
    });
    
    const attributes = attrResponse.data.data || [];
    const attrIds = attributes.map(a => a.id);
    
    // Get values
    const valuesResponse = await api.get('/items/product_attributes', {
      params: {
        filter: {
          product_id: { _in: productIds },
          attribute_id: { _in: attrIds }
        },
        limit: -1,
        fields: ['product_id', 'attribute_id', 'value']
      }
    });
    
    // Build value map
    const valueMap = new Map();
    const codeToId = new Map(attributes.map(a => [a.code, a.id]));
    
    (valuesResponse.data.data || []).forEach(row => {
      const key = `${row.product_id}_${row.attribute_id}`;
      try {
        const parsed = JSON.parse(row.value);
        valueMap.set(key, parsed?.value ?? parsed);
      } catch {
        valueMap.set(key, row.value);
      }
    });
    
    // Inject values into items
    items.value.forEach(item => {
      attributeCodes.forEach(code => {
        const attrId = codeToId.get(code);
        if (attrId) {
          const key = `${item.id}_${attrId}`;
          item[`attr_${code}`] = valueMap.get(key) ?? null;
        }
      });
    });
  } catch (error) {
    console.error('Error loading attribute values:', error);
  }
};

const loadAvailableAttributes = async () => {
  try {
    const response = await api.get('/items/attributes', {
      params: {
        filter: { usable_in_grid: { _eq: true } },
        fields: ['id', 'code', 'label', 'type.*', 'options.*'],
        sort: ['sort'],
        limit: -1
      }
    });
    
    availableAttributes.value = response.data.data || [];
  } catch (error) {
    console.error('Error loading attributes:', error);
  }
};

// UI Methods
const toggleSort = (field: string) => {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortDirection.value = 'asc';
  }
  loadData();
};

const getSortIcon = (field: string) => {
  if (sortField.value !== field) return 'unfold_more';
  return sortDirection.value === 'asc' ? 'arrow_upward' : 'arrow_downward';
};

const applyFilters = debounce(() => {
  page.value = 1;
  loadData();
}, 300);

const clearAllFilters = () => {
  filters.value = {};
  attributeFilters.value = {};
  applyFilters();
};

const toggleColumn = (field: string) => {
  const index = selectedColumns.value.indexOf(field);
  if (index > -1) {
    selectedColumns.value.splice(index, 1);
  } else {
    selectedColumns.value.push(field);
  }
};

const saveColumnSelection = () => {
  showColumnSelector.value = false;
  loadData();
};

const editItem = (item: any) => {
  router.push(`/content/products/${item.id}`);
};

const refresh = () => {
  loadData();
};

const getAttributeValue = (item: any, field: string) => {
  return item[field] ?? null;
};

const formatDate = (date: string) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString();
};

const getAttributeOptions = (attr: any) => {
  if (!attr.options) return [];
  return attr.options.map((opt: any) => ({
    text: opt.label,
    value: opt.code
  }));
};

// Selection
const toggleSelectAll = (value: boolean) => {
  if (value) {
    selectedItems.value = items.value.map(item => item.id);
  } else {
    selectedItems.value = [];
  }
  emit('update:selection', selectedItems.value);
};

const toggleItemSelection = (id: string) => {
  const index = selectedItems.value.indexOf(id);
  if (index > -1) {
    selectedItems.value.splice(index, 1);
  } else {
    selectedItems.value.push(id);
  }
  emit('update:selection', selectedItems.value);
};

const selectItem = (item: any) => {
  // Navigate to item detail
  editItem(item);
};

// Not implemented yet
const exportData = () => {
  notifications.add({
    title: 'Export feature coming soon',
    type: 'info'
  });
};

const duplicateItem = (item: any) => {
  notifications.add({
    title: 'Duplicate feature coming soon',
    type: 'info'
  });
};

const deleteItem = async (item: any) => {
  if (!confirm('Are you sure you want to delete this item?')) return;
  
  try {
    await api.delete(`/items/products/${item.id}`);
    notifications.add({
      title: 'Item deleted',
      type: 'success'
    });
    loadData();
  } catch (error) {
    notifications.add({
      title: 'Error deleting item',
      type: 'error'
    });
  }
};

const setPage = (newPage: number) => {
  page.value = newPage;
  loadData();
};

// Lifecycle
onMounted(async () => {
  await loadAvailableAttributes();
  await loadData();
});

// Watch for external changes
watch(() => props.search, () => {
  page.value = 1;
  loadData();
});

watch(() => props.filter, () => {
  page.value = 1;
  loadData();
});
</script>

<style scoped lang="scss">
.product-grid-layout {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--background-page);
}

.layout-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: var(--background-normal);
  border-bottom: 1px solid var(--border-normal);
}

.layout-title {
  display: flex;
  align-items: baseline;
  gap: 12px;
  
  h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
  }
  
  .item-count {
    color: var(--foreground-subdued);
    font-size: 14px;
  }
}

.layout-actions {
  display: flex;
  gap: 8px;
  
  .filter-count {
    position: absolute;
    top: -4px;
    right: -4px;
    background: var(--primary);
    color: white;
    font-size: 10px;
    padding: 2px 4px;
    border-radius: 8px;
    min-width: 16px;
    text-align: center;
  }
}

.filter-panel {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 320px;
  background: var(--background-normal);
  border-left: 1px solid var(--border-normal);
  padding: 24px;
  overflow-y: auto;
  z-index: 10;
  box-shadow: -2px 0 4px rgba(0, 0, 0, 0.1);
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  
  h3 {
    margin: 0;
    font-size: 18px;
  }
}

.filter-section {
  margin-bottom: 32px;
  
  h4 {
    margin: 0 0 16px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--foreground-subdued);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
}

.filter-item {
  margin-bottom: 16px;
  
  label {
    display: block;
    margin-bottom: 8px;
    font-size: 14px;
    font-weight: 500;
  }
  
  .range-filter {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 8px;
    align-items: center;
    
    span {
      text-align: center;
      color: var(--foreground-subdued);
    }
  }
}

.layout-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: margin-right 0.3s ease;
  
  &.with-filter {
    margin-right: 320px;
  }
}

.loading-state,
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--foreground-subdued);
  
  p {
    margin: 0;
    font-size: 16px;
  }
}

.data-table-wrapper {
  flex: 1;
  overflow: auto;
  background: var(--background-normal);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  
  th {
    position: sticky;
    top: 0;
    background: var(--background-normal);
    padding: 12px 16px;
    text-align: left;
    font-weight: 600;
    font-size: 13px;
    color: var(--foreground-subdued);
    border-bottom: 2px solid var(--border-normal);
    white-space: nowrap;
    
    &.sortable {
      cursor: pointer;
      user-select: none;
      
      &:hover {
        color: var(--foreground-normal);
      }
    }
    
    &.sorted {
      color: var(--primary);
    }
    
    .v-icon {
      vertical-align: middle;
      margin-left: 4px;
    }
  }
  
  td {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-subdued);
  }
  
  tr {
    background: var(--background-normal);
    
    &:hover {
      background: var(--background-subdued);
    }
    
    &.selected {
      background: var(--primary-background);
    }
  }
  
  .checkbox-column {
    width: 40px;
    padding: 8px;
  }
  
  .actions-column {
    width: 60px;
    text-align: center;
  }
  
  .cell-content {
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.pagination {
  padding: 16px;
  border-top: 1px solid var(--border-normal);
  background: var(--background-normal);
  display: flex;
  justify-content: center;
}

.column-selector {
  max-height: 400px;
  overflow-y: auto;
  
  .column-section {
    margin-bottom: 24px;
    
    h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--foreground-subdued);
    }
    
    .v-checkbox {
      margin-bottom: 8px;
    }
  }
}

// Transitions
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}

// Danger styles
.danger {
  --v-list-item-color: var(--danger);
  --v-list-item-color-hover: var(--danger);
  --v-list-item-icon-color: var(--danger);
}
</style>