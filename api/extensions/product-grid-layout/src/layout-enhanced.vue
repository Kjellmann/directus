<template>
  <div class="product-grid-layout">
    <!-- Header with Search and Actions -->
    <div class="layout-header">
      <div class="layout-title">
        <h2>Products</h2>
        <span class="item-count" v-if="!loading">
          {{ totalCount }} {{ totalCount === 1 ? 'item' : 'items' }}
        </span>
      </div>
      
      <div class="layout-search">
        <v-input
          v-model="searchQuery"
          type="search"
          placeholder="Search products..."
          prepend-icon="search"
          :full-width="false"
          @input="debouncedSearch"
        >
          <template #prepend>
            <v-icon name="search" />
          </template>
          <template #append v-if="searchQuery">
            <v-icon 
              name="close" 
              clickable 
              @click="clearSearch"
            />
          </template>
        </v-input>
      </div>
      
      <div class="layout-actions">
        <v-button @click="showColumnSelector = true" icon secondary>
          <v-icon name="view_column" />
        </v-button>
        <v-button @click="showFilterPanel = !showFilterPanel" icon secondary>
          <v-icon name="filter_list" />
          <span v-if="activeFilterCount > 0" class="filter-count">
            {{ activeFilterCount }}
          </span>
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
          <v-button 
            @click="clearAllFilters" 
            x-small 
            secondary 
            v-if="activeFilterCount > 0"
          >
            Clear All
          </v-button>
        </div>
        
        <!-- Active Filters Summary -->
        <div v-if="activeFilterCount > 0" class="active-filters">
          <div 
            v-for="filter in activeFilters" 
            :key="filter.key" 
            class="active-filter-chip"
          >
            <span class="filter-label">{{ filter.label }}:</span>
            <span class="filter-value">{{ filter.displayValue }}</span>
            <v-icon 
              name="close" 
              x-small 
              clickable
              @click="removeFilter(filter)"
            />
          </div>
        </div>
        
        <!-- Standard Fields -->
        <div class="filter-section">
          <h4>Product Fields</h4>
          <div class="filter-item">
            <label>Enabled</label>
            <v-select 
              v-model="filters.enabled" 
              :items="[
                { text: 'All', value: null },
                { text: 'Yes', value: true },
                { text: 'No', value: false }
              ]"
              @update:model-value="applyFilters"
            />
          </div>
          <div class="filter-item">
            <label>Family</label>
            <v-select
              v-model="filters.family"
              :items="familyOptions"
              @update:model-value="applyFilters"
            />
          </div>
        </div>
        
        <!-- Attribute Filters -->
        <div class="filter-section" v-if="filterableAttributes.length > 0">
          <h4>Attributes</h4>
          <div 
            class="filter-item" 
            v-for="attr in filterableAttributes" 
            :key="attr.code"
          >
            <label>{{ attr.label }}</label>
            
            <!-- Text/Identifier -->
            <v-input
              v-if="['text', 'identifier'].includes(attr.type.input_interface)"
              v-model="attributeFilters[attr.code]"
              :placeholder="`Filter by ${attr.label}...`"
              @input="applyFilters"
            />
            
            <!-- Simple Select -->
            <v-select
              v-else-if="attr.type.input_interface === 'simple_select'"
              v-model="attributeFilters[attr.code]"
              :items="[
                { text: 'All', value: null },
                ...getAttributeOptions(attr)
              ]"
              @update:model-value="applyFilters"
            />
            
            <!-- Yes/No -->
            <v-select
              v-else-if="attr.type.input_interface === 'yes_no'"
              v-model="attributeFilters[attr.code]"
              :items="[
                { text: 'All', value: null },
                { text: 'Yes', value: true },
                { text: 'No', value: false }
              ]"
              @update:model-value="applyFilters"
            />
            
            <!-- Number/Price Range -->
            <div 
              v-else-if="['number', 'price', 'metric'].includes(attr.type.input_interface)"
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
            
            <!-- Date Range -->
            <div 
              v-else-if="attr.type.input_interface === 'date'"
              class="range-filter"
            >
              <v-input
                v-model="attributeFilters[`${attr.code}_from`]"
                type="date"
                @input="applyFilters"
              />
              <span>-</span>
              <v-input
                v-model="attributeFilters[`${attr.code}_to`]"
                type="date"
                @input="applyFilters"
              />
            </div>
          </div>
        </div>
      </div>
    </transition>

    <!-- Main Content Area -->
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
                :class="{ 
                  sortable: column.sortable, 
                  sorted: sortField === column.field 
                }"
              >
                <div class="th-content">
                  <span>{{ column.name }}</span>
                  <v-icon 
                    v-if="column.sortable" 
                    :name="getSortIcon(column.field)"
                    x-small
                  />
                </div>
              </th>
              <th class="actions-column">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="item in items" 
              :key="item.id"
              @click="selectRow(item)"
              :class="{ selected: selectedItems.includes(item.id) }"
            >
              <td class="checkbox-column" @click.stop>
                <v-checkbox
                  :model-value="selectedItems.includes(item.id)"
                  @update:model-value="toggleItemSelection(item.id)"
                />
              </td>
              <td 
                v-for="column in visibleColumns" 
                :key="column.field"
                @dblclick="editItem(item)"
              >
                <div class="cell-content">
                  <!-- Standard fields -->
                  <template v-if="!column.isAttribute">
                    <span v-if="column.field === 'id'">
                      {{ item.id.split('-')[0] }}...
                    </span>
                    <span v-else-if="column.type === 'boolean'">
                      <v-icon 
                        :name="item[column.field] ? 'check_circle' : 'cancel'" 
                        :class="item[column.field] ? 'text-success' : 'text-subdued'"
                      />
                    </span>
                    <span v-else-if="column.type === 'datetime'">
                      {{ formatDate(item[column.field]) }}
                    </span>
                    <span v-else-if="column.field === 'family' && families.get(item.family)">
                      {{ families.get(item.family).name }}
                    </span>
                    <span v-else>
                      {{ item[column.field] || '-' }}
                    </span>
                  </template>
                  
                  <!-- Attribute fields -->
                  <grid-attribute-value
                    v-else
                    :value="getAttributeValue(item, column.field)"
                    :attribute="column.attribute"
                  />
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
        
        <!-- Bulk Actions Bar -->
        <transition name="slide-up">
          <div v-if="selectedItems.length > 0" class="bulk-actions-bar">
            <div class="selection-info">
              {{ selectedItems.length }} item{{ selectedItems.length !== 1 ? 's' : '' }} selected
            </div>
            <div class="bulk-actions">
              <v-button @click="bulkEdit" small secondary>
                <v-icon name="edit" left small />
                Edit
              </v-button>
              <v-button @click="bulkExport" small secondary>
                <v-icon name="download" left small />
                Export
              </v-button>
              <v-button @click="bulkDelete" small secondary class="danger">
                <v-icon name="delete" left small />
                Delete
              </v-button>
            </div>
          </div>
        </transition>
      </div>

      <!-- Empty State -->
      <div v-else class="empty-state">
        <v-icon name="inventory_2" large />
        <p>No products found</p>
        <v-button @click="clearAllFilters" v-if="hasActiveFilters">
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
      title="Manage Columns"
      @cancel="showColumnSelector = false"
    >
      <div class="column-selector">
        <div class="column-selector-section">
          <h4>Available Columns</h4>
          <draggable
            v-model="availableColumnsList"
            group="columns"
            class="column-list"
            item-key="field"
          >
            <template #item="{ element }">
              <div class="column-item" @click="addColumn(element)">
                <v-icon name="add_circle_outline" small />
                <span>{{ element.name }}</span>
              </div>
            </template>
          </draggable>
        </div>
        
        <div class="column-selector-section">
          <h4>Selected Columns</h4>
          <draggable
            v-model="selectedColumnsList"
            group="columns"
            class="column-list selected"
            item-key="field"
          >
            <template #item="{ element, index }">
              <div class="column-item">
                <v-icon name="drag_indicator" small class="drag-handle" />
                <span>{{ element.name }}</span>
                <v-icon 
                  name="close" 
                  small 
                  clickable
                  @click="removeColumn(index)"
                />
              </div>
            </template>
          </draggable>
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
import draggable from 'vuedraggable';
import GridAttributeValue from './components/GridAttributeValue.vue';

interface Props {
  collection: string;
}

const props = withDefaults(defineProps<Props>(), {
  collection: 'products'
});

const api = useApi();
const router = useRouter();
const { useNotificationsStore } = useStores();
const notifications = useNotificationsStore();

// State
const loading = ref(false);
const items = ref<any[]>([]);
const totalCount = ref(0);
const page = ref(1);
const limit = 25;
const selectedItems = ref<string[]>([]);
const showFilterPanel = ref(false);
const showColumnSelector = ref(false);
const searchQuery = ref('');

// Filters
const filters = ref<any>({
  enabled: null,
  family: null
});
const attributeFilters = ref<Record<string, any>>({});

// Sorting
const sortField = ref<string | null>(null);
const sortDirection = ref<'asc' | 'desc'>('asc');

// Data
const attributes = ref<any[]>([]);
const families = ref(new Map());
const filterableAttributes = ref<any[]>([]);

// Columns
const standardColumns = [
  { field: 'id', name: 'ID', type: 'uuid', sortable: true },
  { field: 'enabled', name: 'Enabled', type: 'boolean', sortable: true },
  { field: 'family', name: 'Family', type: 'relation', sortable: true },
  { field: 'date_created', name: 'Created', type: 'datetime', sortable: true },
  { field: 'date_updated', name: 'Updated', type: 'datetime', sortable: true }
];

const selectedColumns = ref<string[]>(['id', 'enabled', 'family', 'date_created']);
const availableColumnsList = ref<any[]>([]);
const selectedColumnsList = ref<any[]>([]);

// Computed
const totalPages = computed(() => Math.ceil(totalCount.value / limit));

const visibleColumns = computed(() => {
  return selectedColumns.value.map(field => {
    if (field.startsWith('attr_')) {
      const code = field.replace('attr_', '');
      const attr = attributes.value.find(a => a.code === code);
      return {
        field,
        name: attr?.label || code,
        type: 'attribute',
        sortable: true,
        isAttribute: true,
        attribute: attr
      };
    } else {
      const standardCol = standardColumns.find(c => c.field === field);
      return {
        field,
        name: standardCol?.name || field,
        type: standardCol?.type || 'string',
        sortable: standardCol?.sortable || false,
        isAttribute: false
      };
    }
  });
});

const allSelected = computed(() => {
  return items.value.length > 0 && 
         items.value.every(item => selectedItems.value.includes(item.id));
});

const hasActiveFilters = computed(() => {
  return activeFilterCount.value > 0 || searchQuery.value !== '';
});

const activeFilterCount = computed(() => {
  let count = 0;
  
  Object.entries(filters.value).forEach(([_, value]) => {
    if (value !== null && value !== '') count++;
  });
  
  Object.entries(attributeFilters.value).forEach(([_, value]) => {
    if (value !== null && value !== '') count++;
  });
  
  return count;
});

const activeFilters = computed(() => {
  const active: any[] = [];
  
  // Standard filters
  Object.entries(filters.value).forEach(([field, value]) => {
    if (value !== null && value !== '') {
      let displayValue = value;
      let label = field;
      
      if (field === 'enabled') {
        displayValue = value ? 'Yes' : 'No';
        label = 'Enabled';
      } else if (field === 'family' && families.value.get(value)) {
        displayValue = families.value.get(value).name;
        label = 'Family';
      }
      
      active.push({
        key: `std_${field}`,
        field,
        value,
        displayValue,
        label,
        type: 'standard'
      });
    }
  });
  
  // Attribute filters
  Object.entries(attributeFilters.value).forEach(([field, value]) => {
    if (value !== null && value !== '') {
      const baseField = field.replace(/_min|_max|_from|_to$/, '');
      const attr = filterableAttributes.value.find(a => a.code === baseField);
      
      if (attr) {
        active.push({
          key: `attr_${field}`,
          field,
          value,
          displayValue: formatFilterValue(value, attr),
          label: attr.label,
          type: 'attribute'
        });
      }
    }
  });
  
  return active;
});

const familyOptions = computed(() => {
  const options = [{ text: 'All', value: null }];
  families.value.forEach((family, id) => {
    options.push({ text: family.name, value: id });
  });
  return options;
});

// Methods
const loadData = async () => {
  loading.value = true;
  
  try {
    const params: any = {
      limit,
      offset: (page.value - 1) * limit
    };
    
    // Add search
    if (searchQuery.value) {
      params.search = searchQuery.value;
    }
    
    // Add filters
    const filterObj: any = {};
    
    Object.entries(filters.value).forEach(([field, value]) => {
      if (value !== null && value !== '') {
        filterObj[field] = { _eq: value };
      }
    });
    
    if (Object.keys(filterObj).length > 0) {
      params.filter = JSON.stringify(filterObj);
    }
    
    // Add attribute filters
    const attrFilters = Object.entries(attributeFilters.value)
      .filter(([_, value]) => value !== null && value !== '')
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
    
    if (Object.keys(attrFilters).length > 0) {
      params.attribute_filters = JSON.stringify(attrFilters);
    }
    
    // Add sort
    if (sortField.value) {
      params.sort = `${sortDirection.value === 'desc' ? '-' : ''}${sortField.value}`;
    }
    
    // Fetch data
    const response = await api.get('/product-grid/products', { params });
    
    items.value = response.data.data || [];
    totalCount.value = parseInt(response.data.meta?.total_count || '0');
    
    // Load attribute values
    if (items.value.length > 0 && visibleColumns.value.some(c => c.isAttribute)) {
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
  const visibleAttributeColumns = visibleColumns.value.filter(c => c.isAttribute);
  
  if (visibleAttributeColumns.length === 0) return;
  
  try {
    const attrIds = visibleAttributeColumns
      .map(c => c.attribute?.id)
      .filter(Boolean);
    
    const response = await api.get('/items/product_attributes', {
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
    (response.data.data || []).forEach((row: any) => {
      const key = `${row.product_id}_${row.attribute_id}`;
      valueMap.set(key, row.value);
    });
    
    // Inject values into items
    items.value.forEach(item => {
      visibleAttributeColumns.forEach(col => {
        if (col.attribute) {
          const key = `${item.id}_${col.attribute.id}`;
          item[col.field] = valueMap.get(key) ?? null;
        }
      });
    });
  } catch (error) {
    console.error('Error loading attribute values:', error);
  }
};

const loadAttributes = async () => {
  try {
    const response = await api.get('/items/attributes', {
      params: {
        filter: { usable_in_grid: { _eq: true } },
        fields: ['id', 'code', 'label', 'type.*', 'options.*', 'units.*'],
        sort: ['sort'],
        limit: -1
      }
    });
    
    attributes.value = response.data.data || [];
    
    // Set filterable attributes (first 10)
    filterableAttributes.value = attributes.value.slice(0, 10);
    
    // Update available columns
    updateAvailableColumns();
  } catch (error) {
    console.error('Error loading attributes:', error);
  }
};

const loadFamilies = async () => {
  try {
    const response = await api.get('/items/families', {
      params: {
        fields: ['id', 'name'],
        limit: -1
      }
    });
    
    families.value.clear();
    (response.data.data || []).forEach((family: any) => {
      families.value.set(family.id, family);
    });
  } catch (error) {
    console.error('Error loading families:', error);
  }
};

// Search
const debouncedSearch = debounce(() => {
  page.value = 1;
  loadData();
}, 300);

const clearSearch = () => {
  searchQuery.value = '';
  debouncedSearch();
};

// Filters
const applyFilters = debounce(() => {
  page.value = 1;
  loadData();
}, 300);

const clearAllFilters = () => {
  filters.value = {
    enabled: null,
    family: null
  };
  attributeFilters.value = {};
  searchQuery.value = '';
  applyFilters();
};

const removeFilter = (filter: any) => {
  if (filter.type === 'standard') {
    filters.value[filter.field] = null;
  } else {
    delete attributeFilters.value[filter.field];
  }
  applyFilters();
};

// Sorting
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

// Selection
const toggleSelectAll = (value: boolean) => {
  if (value) {
    selectedItems.value = items.value.map(item => item.id);
  } else {
    selectedItems.value = [];
  }
};

const toggleItemSelection = (id: string) => {
  const index = selectedItems.value.indexOf(id);
  if (index > -1) {
    selectedItems.value.splice(index, 1);
  } else {
    selectedItems.value.push(id);
  }
};

const selectRow = (item: any) => {
  // Single click - toggle selection
  toggleItemSelection(item.id);
};

// Actions
const editItem = (item: any) => {
  router.push(`/content/products/${item.id}`);
};

const duplicateItem = async (item: any) => {
  try {
    // TODO: Implement duplication
    notifications.add({
      title: 'Duplicate feature coming soon',
      type: 'info'
    });
  } catch (error) {
    notifications.add({
      title: 'Error duplicating item',
      type: 'error'
    });
  }
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

// Bulk Actions
const bulkEdit = () => {
  // TODO: Implement bulk edit
  notifications.add({
    title: 'Bulk edit coming soon',
    type: 'info'
  });
};

const bulkExport = async () => {
  try {
    const ids = selectedItems.value.join(',');
    window.open(`/product-grid/products/export?format=csv&include_attributes=true&ids=${ids}`);
  } catch (error) {
    notifications.add({
      title: 'Export failed',
      type: 'error'
    });
  }
};

const bulkDelete = async () => {
  if (!confirm(`Are you sure you want to delete ${selectedItems.value.length} items?`)) return;
  
  try {
    // TODO: Implement bulk delete
    notifications.add({
      title: 'Bulk delete coming soon',
      type: 'info'
    });
  } catch (error) {
    notifications.add({
      title: 'Error deleting items',
      type: 'error'
    });
  }
};

// Export
const exportData = () => {
  window.open('/product-grid/products/export?format=csv&include_attributes=true');
};

// Column Management
const updateAvailableColumns = () => {
  // Standard columns not selected
  const selectedSet = new Set(selectedColumns.value);
  availableColumnsList.value = [
    ...standardColumns.filter(c => !selectedSet.has(c.field)),
    ...attributes.value
      .filter(a => !selectedSet.has(`attr_${a.code}`))
      .map(a => ({
        field: `attr_${a.code}`,
        name: a.label,
        type: 'attribute'
      }))
  ];
  
  // Selected columns in order
  selectedColumnsList.value = selectedColumns.value.map(field => {
    if (field.startsWith('attr_')) {
      const code = field.replace('attr_', '');
      const attr = attributes.value.find(a => a.code === code);
      return {
        field,
        name: attr?.label || code,
        type: 'attribute'
      };
    } else {
      const col = standardColumns.find(c => c.field === field);
      return col || { field, name: field, type: 'string' };
    }
  });
};

const addColumn = (column: any) => {
  selectedColumns.value.push(column.field);
  updateAvailableColumns();
};

const removeColumn = (index: number) => {
  selectedColumns.value.splice(index, 1);
  updateAvailableColumns();
};

const saveColumnSelection = () => {
  selectedColumns.value = selectedColumnsList.value.map(c => c.field);
  showColumnSelector.value = false;
  loadData();
};

// Utilities
const formatDate = (date: string) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString();
};

const formatFilterValue = (value: any, attr: any) => {
  if (attr.type.input_interface === 'simple_select' && attr.options) {
    const option = attr.options.find((o: any) => o.code === value);
    return option?.label || value;
  }
  return String(value);
};

const getAttributeValue = (item: any, field: string) => {
  return item[field] ?? null;
};

const getAttributeOptions = (attr: any) => {
  if (!attr.options) return [];
  return attr.options.map((opt: any) => ({
    text: opt.label,
    value: opt.code
  }));
};

const refresh = () => {
  loadData();
};

const setPage = (newPage: number) => {
  page.value = newPage;
  loadData();
};

// Lifecycle
onMounted(async () => {
  await Promise.all([
    loadAttributes(),
    loadFamilies()
  ]);
  await loadData();
});

// Update columns when attributes change
watch(() => attributes.value, () => {
  updateAvailableColumns();
});
</script>

<style scoped>
.product-grid-layout {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--background-page);
}

/* Header */
.layout-header {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 16px 24px;
  background: var(--background-normal);
  border-bottom: 1px solid var(--border-normal);
}

.layout-title {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.layout-title h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.item-count {
  color: var(--foreground-subdued);
  font-size: 14px;
}

.layout-search {
  flex: 1;
  max-width: 400px;
}

.layout-actions {
  display: flex;
  gap: 8px;
  position: relative;
}

.filter-count {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--primary);
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 18px;
  text-align: center;
}

/* Filter Panel */
.filter-panel {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 360px;
  background: var(--background-normal);
  border-left: 1px solid var(--border-normal);
  padding: 24px;
  overflow-y: auto;
  z-index: 10;
  box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.filter-header h3 {
  margin: 0;
  font-size: 18px;
}

.active-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 24px;
  padding: 12px;
  background: var(--background-subdued);
  border-radius: var(--border-radius);
}

.active-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--background-normal);
  border: 1px solid var(--border-normal);
  border-radius: var(--border-radius);
  font-size: 12px;
}

.filter-label {
  font-weight: 600;
  color: var(--foreground-subdued);
}

.filter-value {
  color: var(--foreground-normal);
}

.filter-section {
  margin-bottom: 32px;
}

.filter-section h4 {
  margin: 0 0 16px 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--foreground-subdued);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.filter-item {
  margin-bottom: 16px;
}

.filter-item label {
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
}

.range-filter span {
  text-align: center;
  color: var(--foreground-subdued);
}

/* Main Content */
.layout-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: margin-right 0.3s ease;
}

.layout-content.with-filter {
  margin-right: 360px;
}

/* States */
.loading-state,
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--foreground-subdued);
}

/* Data Table */
.data-table-wrapper {
  flex: 1;
  overflow: auto;
  background: var(--background-normal);
  position: relative;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th {
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
  z-index: 1;
}

.data-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.data-table th.sortable:hover {
  color: var(--foreground-normal);
}

.data-table th.sorted {
  color: var(--primary);
}

.th-content {
  display: flex;
  align-items: center;
  gap: 4px;
}

.data-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subdued);
}

.data-table tr {
  background: var(--background-normal);
  transition: background-color 0.1s;
}

.data-table tr:hover {
  background: var(--background-subdued);
}

.data-table tr.selected {
  background: var(--primary-background);
}

.checkbox-column {
  width: 48px;
  padding: 8px 12px;
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

/* Bulk Actions Bar */
.bulk-actions-bar {
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  background: var(--background-normal-alt);
  border-top: 1px solid var(--border-normal);
  box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.1);
}

.selection-info {
  font-size: 14px;
  color: var(--foreground-subdued);
}

.bulk-actions {
  display: flex;
  gap: 8px;
}

/* Pagination */
.pagination {
  padding: 16px;
  border-top: 1px solid var(--border-normal);
  background: var(--background-normal);
  display: flex;
  justify-content: center;
}

/* Column Selector */
.column-selector {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  min-height: 400px;
}

.column-selector-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--foreground-subdued);
}

.column-list {
  border: 1px solid var(--border-normal);
  border-radius: var(--border-radius);
  background: var(--background-subdued);
  padding: 8px;
  min-height: 350px;
  overflow-y: auto;
}

.column-list.selected {
  background: var(--background-normal);
}

.column-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin-bottom: 4px;
  background: var(--background-normal);
  border: 1px solid var(--border-subdued);
  border-radius: var(--border-radius);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.column-item:hover {
  background: var(--background-normal-alt);
  border-color: var(--border-normal);
}

.drag-handle {
  cursor: move;
  color: var(--foreground-subdued);
}

/* Transitions */
.slide-enter-active,
.slide-leave-active {
  transition: transform 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.2s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}

/* Utilities */
.text-success {
  color: var(--success);
}

.text-subdued {
  color: var(--foreground-subdued);
}

.danger {
  --v-list-item-color: var(--danger);
  --v-list-item-color-hover: var(--danger);
  --v-list-item-icon-color: var(--danger);
}
</style>