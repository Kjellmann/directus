<template>
  <div class="product-grid-layout">
    <div class="layout-header">
      <div class="layout-title">
        <h2>Products Grid</h2>
        <span class="item-count" v-if="!loading">{{ totalCount }} items</span>
      </div>
      <div class="layout-actions">
        <v-button @click="showFilterPanel = !showFilterPanel" icon secondary>
          <v-icon name="filter_list" />
        </v-button>
        <v-button @click="refresh" icon secondary>
          <v-icon name="refresh" />
        </v-button>
      </div>
    </div>

    <!-- Filter Panel -->
    <div v-if="showFilterPanel" class="filter-panel">
      <h3>Filters</h3>
      
      <div class="filter-section">
        <h4>Standard Fields</h4>
        <div class="filter-item">
          <label>ID</label>
          <v-input v-model="filters.id" placeholder="Filter by ID..." />
        </div>
        <div class="filter-item">
          <label>Enabled</label>
          <v-select 
            v-model="filters.enabled" 
            :items="[
              { text: 'All', value: null },
              { text: 'Yes', value: true },
              { text: 'No', value: false }
            ]"
          />
        </div>
      </div>

      <div class="filter-section" v-if="attributes.length > 0">
        <h4>Attributes</h4>
        <div class="filter-item" v-for="attr in attributes" :key="attr.code">
          <label>{{ attr.label }}</label>
          <v-input 
            v-model="attributeFilters[attr.code]"
            :placeholder="`Filter by ${attr.label}...`"
          />
        </div>
      </div>

      <v-button @click="applyFilters" small>Apply Filters</v-button>
    </div>

    <div class="layout-content" :class="{ 'with-filter': showFilterPanel }">
      <div v-if="loading" class="loading-state">
        <v-progress-circular />
        <p>Loading products...</p>
      </div>
      
      <div v-else-if="items.length > 0" class="data-table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th @click="toggleSort('id')" class="sortable">
                ID
                <v-icon :name="getSortIcon('id')" small />
              </th>
              <th @click="toggleSort('enabled')" class="sortable">
                Enabled
                <v-icon :name="getSortIcon('enabled')" small />
              </th>
              <th @click="toggleSort('date_created')" class="sortable">
                Created
                <v-icon :name="getSortIcon('date_created')" small />
              </th>
              <th v-for="attr in visibleAttributes" :key="attr.code" 
                  @click="toggleSort(`attr_${attr.code}`)" class="sortable">
                {{ attr.label }}
                <v-icon :name="getSortIcon(`attr_${attr.code}`)" small />
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id" @click="editItem(item)">
              <td>{{ item.id }}</td>
              <td>
                <v-icon :name="item.enabled ? 'check' : 'close'" />
              </td>
              <td>{{ formatDate(item.date_created) }}</td>
              <td v-for="attr in visibleAttributes" :key="attr.code">
                {{ getAttributeValue(item, attr.code) || '-' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <div v-else class="empty-state">
        <v-icon name="inventory_2" large />
        <p>No products found</p>
      </div>

      <div class="pagination" v-if="totalPages > 1">
        <v-pagination
          :model-value="page"
          :total-pages="totalPages"
          @update:model-value="setPage"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useApi } from '@directus/extensions-sdk';
import { useRouter } from 'vue-router';

const api = useApi();
const router = useRouter();

// State
const loading = ref(false);
const items = ref<any[]>([]);
const totalCount = ref(0);
const page = ref(1);
const limit = 25;
const showFilterPanel = ref(false);

// Filters
const filters = ref({
  id: '',
  enabled: null
});
const attributeFilters = ref<Record<string, any>>({});

// Attributes
const attributes = ref<any[]>([]);
const visibleAttributes = computed(() => attributes.value.slice(0, 5)); // Show first 5 attributes

// Sorting
const sortField = ref<string | null>(null);
const sortDirection = ref<'asc' | 'desc'>('asc');

// Computed
const totalPages = computed(() => Math.ceil(totalCount.value / limit));

// Methods
const loadData = async () => {
  loading.value = true;
  
  try {
    // Use the custom endpoint
    const params: any = {
      limit,
      offset: (page.value - 1) * limit
    };
    
    // Add filters
    const filterObj: any = {};
    if (filters.value.id) {
      filterObj.id = { _contains: filters.value.id };
    }
    if (filters.value.enabled !== null) {
      filterObj.enabled = { _eq: filters.value.enabled };
    }
    
    if (Object.keys(filterObj).length > 0) {
      params.filter = JSON.stringify(filterObj);
    }
    
    // Add attribute filters
    const attrFilters = Object.entries(attributeFilters.value)
      .filter(([_, value]) => value)
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
    
    if (Object.keys(attrFilters).length > 0) {
      params.attribute_filters = JSON.stringify(attrFilters);
    }
    
    // Add sort
    if (sortField.value) {
      params.sort = `${sortDirection.value === 'desc' ? '-' : ''}${sortField.value}`;
    }
    
    const response = await api.get('/product-grid/products', { params });
    
    items.value = response.data.data || [];
    totalCount.value = parseInt(response.data.meta?.total_count || '0');
    
    // Load attribute values if we have items
    if (items.value.length > 0 && visibleAttributes.value.length > 0) {
      await loadAttributeValues();
    }
  } catch (error) {
    console.error('Error loading data:', error);
  } finally {
    loading.value = false;
  }
};

const loadAttributeValues = async () => {
  const productIds = items.value.map(item => item.id);
  const attributeCodes = visibleAttributes.value.map(attr => attr.code);
  
  try {
    // Get attribute values
    const response = await api.get('/items/product_attributes', {
      params: {
        filter: {
          product_id: { _in: productIds },
          attribute_id: { _in: visibleAttributes.value.map(a => a.id) }
        },
        limit: -1,
        fields: ['product_id', 'attribute_id', 'value']
      }
    });
    
    // Build value map
    const valueMap = new Map();
    (response.data.data || []).forEach(row => {
      try {
        const parsed = JSON.parse(row.value);
        const value = parsed?.value ?? parsed;
        const key = `${row.product_id}_${row.attribute_id}`;
        valueMap.set(key, value);
      } catch {
        valueMap.set(`${row.product_id}_${row.attribute_id}`, row.value);
      }
    });
    
    // Inject values into items
    items.value.forEach(item => {
      visibleAttributes.value.forEach(attr => {
        const key = `${item.id}_${attr.id}`;
        item[`attr_${attr.code}`] = valueMap.get(key) ?? null;
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
        fields: ['id', 'code', 'label'],
        sort: ['sort'],
        limit: 10
      }
    });
    
    attributes.value = response.data.data || [];
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

const applyFilters = () => {
  page.value = 1;
  loadData();
};

const refresh = () => {
  loadData();
};

const editItem = (item: any) => {
  router.push(`/content/products/${item.id}`);
};

const formatDate = (date: string) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString();
};

const getAttributeValue = (item: any, code: string) => {
  return item[`attr_${code}`];
};

const setPage = (newPage: number) => {
  page.value = newPage;
  loadData();
};

// Lifecycle
onMounted(async () => {
  await loadAttributes();
  await loadData();
});
</script>

<style scoped>
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

.layout-actions {
  display: flex;
  gap: 8px;
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

.filter-panel h3 {
  margin: 0 0 24px 0;
  font-size: 18px;
}

.filter-section {
  margin-bottom: 24px;
}

.filter-section h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
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

.layout-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: margin-right 0.3s ease;
}

.layout-content.with-filter {
  margin-right: 320px;
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
}

.data-table-wrapper {
  flex: 1;
  overflow: auto;
  background: var(--background-normal);
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
}

.data-table th.sortable {
  cursor: pointer;
  user-select: none;
}

.data-table th.sortable:hover {
  color: var(--foreground-normal);
}

.data-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subdued);
}

.data-table tr {
  background: var(--background-normal);
  cursor: pointer;
}

.data-table tr:hover {
  background: var(--background-subdued);
}

.pagination {
  padding: 16px;
  border-top: 1px solid var(--border-normal);
  background: var(--background-normal);
  display: flex;
  justify-content: center;
}
</style>