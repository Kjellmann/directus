# Product Grid Dynamic Attribute Filtering & Sorting Plan

## Overview
This document outlines a comprehensive, database-agnostic solution for filtering and sorting dynamic attributes in the Product Grid layout extension. The solution follows Directus best practices and leverages existing database fields (`usable_in_filter`, `usable_in_search`) while maintaining compatibility with PostgreSQL and other databases.

## Current Architecture

### Database Structure
```sql
-- Attributes table (existing)
CREATE TABLE attributes (
    id SERIAL PRIMARY KEY,
    code VARCHAR(255) UNIQUE NOT NULL,
    label VARCHAR(255),
    type VARCHAR(50),
    usable_in_search BOOLEAN DEFAULT false,  -- Used for display
    usable_in_filter BOOLEAN DEFAULT false,  -- Will use for filtering
    usable_in_grid BOOLEAN DEFAULT true
);

-- Product attributes junction table
CREATE TABLE product_attributes (
    id SERIAL PRIMARY KEY,
    product_id UUID NOT NULL,
    attribute_id INTEGER NOT NULL,
    value JSONB
);
```

### Current Implementation
- **API Endpoint**: `/product-grid/products` handles attribute value fetching and sorting
- **Frontend**: ProductTable.vue dynamically loads and displays attribute columns
- **Sorting**: Already implemented for dynamic attributes in the API

## Proposed Filtering Solution

### 1. Backend Implementation (product-grid-api/src/index.ts)

#### Enhanced Products Endpoint
```typescript
router.get('/products', async (req, res) => {
  const {
    limit = 25,
    page = 1,
    sort,
    search,
    filter,
    attribute_filters  // New parameter for attribute-specific filters
  } = req.query;
  
  // Parse attribute filters
  // Format: { "attr_color": { "_eq": "red" }, "attr_size": { "_in": ["M", "L"] } }
  const parsedAttributeFilters = attribute_filters ? JSON.parse(attribute_filters) : {};
  
  // Step 1: Get filterable attributes
  const attributesService = new ItemsService('attributes', { schema, accountability });
  const filterableAttributes = await attributesService.readByQuery({
    filter: { 
      usable_in_filter: { _eq: true },
      usable_in_grid: { _eq: true }
    },
    fields: ['id', 'code', 'label', 'type'],
    limit: -1
  });
  
  // Step 2: Apply attribute filters
  if (Object.keys(parsedAttributeFilters).length > 0) {
    // Build subqueries for each attribute filter
    const attributeFilterConditions = [];
    
    for (const [field, condition] of Object.entries(parsedAttributeFilters)) {
      if (field.startsWith('attr_')) {
        const attrCode = field.substring(5);
        const attribute = filterableAttributes.find(a => a.code === attrCode);
        
        if (attribute) {
          // Convert Directus filter operators to SQL conditions
          const productIds = await getProductIdsByAttributeFilter(
            attribute.id,
            condition,
            { database, logger }
          );
          
          if (productIds.length > 0) {
            attributeFilterConditions.push({
              id: { _in: productIds }
            });
          }
        }
      }
    }
    
    // Merge with existing filters
    if (attributeFilterConditions.length > 0) {
      parsedFilter._and = [
        ...(parsedFilter._and || []),
        ...attributeFilterConditions
      ];
    }
  }
  
  // Continue with existing query logic...
});

// Helper function for attribute filtering
async function getProductIdsByAttributeFilter(attributeId, condition, { database, logger }) {
  const productAttributesService = new ItemsService('product_attributes', { schema, accountability });
  
  // Build filter for attribute values
  const valueFilter = {};
  
  // Handle different operators
  for (const [operator, value] of Object.entries(condition)) {
    switch (operator) {
      case '_eq':
        valueFilter.value = { _contains: { value: value } };
        break;
      case '_neq':
        valueFilter.value = { _ncontains: { value: value } };
        break;
      case '_in':
        valueFilter._or = value.map(v => ({ value: { _contains: { value: v } } }));
        break;
      case '_contains':
        valueFilter.value = { _contains: { value: value } };
        break;
      // Add more operators as needed
    }
  }
  
  // Query matching product_attributes
  const matches = await productAttributesService.readByQuery({
    filter: {
      attribute_id: { _eq: attributeId },
      ...valueFilter
    },
    fields: ['product_id'],
    limit: -1
  });
  
  return matches.map(m => m.product_id);
}
```

#### Filter Options Endpoint
```typescript
// New endpoint to get available filter values for attributes
router.get('/products/filters', async (req, res) => {
  const { attribute_code } = req.query;
  
  // Get the attribute
  const attributesService = new ItemsService('attributes', { schema, accountability });
  const attribute = await attributesService.readByQuery({
    filter: { 
      code: { _eq: attribute_code },
      usable_in_filter: { _eq: true }
    },
    limit: 1
  });
  
  if (!attribute || attribute.length === 0) {
    return res.json({ data: [] });
  }
  
  // Get unique values for this attribute
  const productAttributesService = new ItemsService('product_attributes', { schema, accountability });
  const values = await productAttributesService.readByQuery({
    filter: { attribute_id: { _eq: attribute[0].id } },
    fields: ['value'],
    limit: -1
  });
  
  // Extract unique values
  const uniqueValues = new Set();
  values.forEach(v => {
    try {
      const parsed = JSON.parse(v.value);
      uniqueValues.add(parsed?.value ?? parsed);
    } catch {
      uniqueValues.add(v.value);
    }
  });
  
  res.json({
    data: Array.from(uniqueValues).filter(v => v !== null && v !== '').sort()
  });
});
```

### 2. Frontend Implementation

#### Filter Component (components/ProductFilters.vue)
```vue
<template>
  <div class="product-filters">
    <v-button @click="showFilters = !showFilters" icon small>
      <v-icon name="filter_list" />
      <v-badge v-if="activeFilterCount > 0" :value="activeFilterCount" />
    </v-button>
    
    <v-drawer
      v-model="showFilters"
      title="Filters"
      icon="filter_list"
      @cancel="showFilters = false"
    >
      <template #sidebar>
        <div class="filter-sidebar">
          <!-- Standard field filters -->
          <div class="filter-group">
            <div class="filter-group-title">{{ t('standard_fields') }}</div>
            
            <!-- Enabled filter -->
            <div class="filter-field">
              <label>{{ t('enabled') }}</label>
              <v-checkbox
                v-model="filters.enabled"
                :label="t('show_enabled_only')"
              />
            </div>
            
            <!-- Date range filter -->
            <div class="filter-field">
              <label>{{ t('created_date') }}</label>
              <interface-datetime
                v-model="filters.date_created_start"
                :type="'date'"
                :placeholder="t('from')"
              />
              <interface-datetime
                v-model="filters.date_created_end"
                :type="'date'"
                :placeholder="t('to')"
              />
            </div>
          </div>
          
          <!-- Dynamic attribute filters -->
          <div class="filter-group" v-if="filterableAttributes.length > 0">
            <div class="filter-group-title">{{ t('attributes') }}</div>
            
            <div
              v-for="attr in filterableAttributes"
              :key="attr.id"
              class="filter-field"
            >
              <label>{{ attr.label }}</label>
              
              <!-- Different filter types based on attribute type -->
              <component
                :is="getFilterComponent(attr.type)"
                v-model="attributeFilters[`attr_${attr.code}`]"
                :attribute="attr"
                :options="getFilterOptions(attr)"
                @input="onAttributeFilterChange"
              />
            </div>
          </div>
          
          <div class="filter-actions">
            <v-button secondary @click="clearFilters">
              {{ t('clear_filters') }}
            </v-button>
            <v-button @click="applyFilters">
              {{ t('apply_filters') }}
            </v-button>
          </div>
        </div>
      </template>
    </v-drawer>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useApi } from '@directus/extensions-sdk';

const props = defineProps({
  attributes: Array,
  currentFilters: Object
});

const emit = defineEmits(['update:filters']);

const api = useApi();
const showFilters = ref(false);
const filters = ref({});
const attributeFilters = ref({});
const filterOptions = ref({});

// Get filterable attributes
const filterableAttributes = computed(() => 
  props.attributes.filter(attr => attr.usable_in_filter)
);

// Count active filters
const activeFilterCount = computed(() => {
  let count = 0;
  // Count standard filters
  Object.values(filters.value).forEach(val => {
    if (val !== null && val !== undefined && val !== '') count++;
  });
  // Count attribute filters
  Object.values(attributeFilters.value).forEach(val => {
    if (val !== null && val !== undefined && val !== '') count++;
  });
  return count;
});

// Load filter options for attributes
async function loadFilterOptions(attribute) {
  try {
    const response = await api.get('/product-grid/products/filters', {
      params: { attribute_code: attribute.code }
    });
    filterOptions.value[attribute.code] = response.data.data;
  } catch (error) {
    console.error('Failed to load filter options:', error);
  }
}

// Get appropriate filter component based on type
function getFilterComponent(type) {
  switch (type) {
    case 'boolean':
      return 'v-checkbox';
    case 'select':
    case 'multiselect':
      return 'v-select';
    case 'number':
    case 'decimal':
      return 'interface-input';
    case 'date':
      return 'interface-datetime';
    default:
      return 'v-input';
  }
}

// Apply filters
function applyFilters() {
  const combinedFilters = {
    ...buildStandardFilters(),
    attribute_filters: JSON.stringify(attributeFilters.value)
  };
  
  emit('update:filters', combinedFilters);
  showFilters.value = false;
}

// Build standard Directus filters
function buildStandardFilters() {
  const directusFilter = {};
  
  if (filters.value.enabled !== undefined) {
    directusFilter.enabled = { _eq: filters.value.enabled };
  }
  
  if (filters.value.date_created_start || filters.value.date_created_end) {
    directusFilter.date_created = {};
    if (filters.value.date_created_start) {
      directusFilter.date_created._gte = filters.value.date_created_start;
    }
    if (filters.value.date_created_end) {
      directusFilter.date_created._lte = filters.value.date_created_end;
    }
  }
  
  return Object.keys(directusFilter).length > 0 ? directusFilter : null;
}

// Initialize filter options
onMounted(() => {
  filterableAttributes.value.forEach(attr => {
    loadFilterOptions(attr);
  });
});
</script>
```

#### Integration with ProductTable.vue
```vue
<!-- Add to ProductTable.vue template -->
<template>
  <div class="product-table-wrapper">
    <div class="table-header">
      <product-filters
        :attributes="attributes"
        :current-filters="currentFilters"
        @update:filters="onFiltersUpdate"
      />
      
      <!-- Existing column selector button -->
      <v-menu v-model="columnMenuOpen">
        <!-- ... -->
      </v-menu>
    </div>
    
    <!-- Rest of the table -->
    <v-table>
      <!-- ... -->
    </v-table>
  </div>
</template>

<script setup>
// Add to existing props
const props = defineProps({
  // ... existing props
  filter: Object,
  onFilterChange: Function
});

// Handle filter updates
function onFiltersUpdate(newFilters) {
  props.onFilterChange(newFilters);
}
</script>
```

### 3. Advanced Filter UI Components

#### Multi-Select Filter
```vue
<template>
  <v-select
    v-model="selectedValues"
    :items="options"
    multiple
    :placeholder="t('select_values')"
    @update:model-value="updateFilter"
  />
</template>

<script setup>
const props = defineProps({
  modelValue: Object,
  attribute: Object,
  options: Array
});

const selectedValues = ref([]);

function updateFilter(values) {
  if (values.length === 0) {
    emit('update:modelValue', null);
  } else if (values.length === 1) {
    emit('update:modelValue', { _eq: values[0] });
  } else {
    emit('update:modelValue', { _in: values });
  }
}
</script>
```

#### Range Filter (for numeric attributes)
```vue
<template>
  <div class="range-filter">
    <v-input
      v-model="minValue"
      type="number"
      :placeholder="t('min')"
      @update:model-value="updateFilter"
    />
    <span>-</span>
    <v-input
      v-model="maxValue"
      type="number"
      :placeholder="t('max')"
      @update:model-value="updateFilter"
    />
  </div>
</template>

<script setup>
const minValue = ref(null);
const maxValue = ref(null);

function updateFilter() {
  const filter = {};
  if (minValue.value !== null) filter._gte = minValue.value;
  if (maxValue.value !== null) filter._lte = maxValue.value;
  
  emit('update:modelValue', Object.keys(filter).length > 0 ? filter : null);
}
</script>
```

### 4. Performance Optimizations

#### Caching Strategy
```typescript
// Add to API endpoint
const filterCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

router.get('/products/filters', async (req, res) => {
  const { attribute_code } = req.query;
  const cacheKey = `filters_${attribute_code}`;
  
  // Check cache
  const cached = filterCache.get(cacheKey);
  if (cached && cached.timestamp > Date.now() - CACHE_TTL) {
    return res.json({ data: cached.values });
  }
  
  // ... fetch values ...
  
  // Cache the result
  filterCache.set(cacheKey, {
    values: Array.from(uniqueValues),
    timestamp: Date.now()
  });
});
```

#### Debounced Filter Application
```vue
<script setup>
import { debounce } from 'lodash-es';

// Debounce filter application for better performance
const debouncedApplyFilters = debounce(() => {
  applyFilters();
}, 300);

// Auto-apply filters on change (optional)
watch(attributeFilters, () => {
  if (props.autoApply) {
    debouncedApplyFilters();
  }
}, { deep: true });
</script>
```

### 5. Smart Filter Suggestions

#### Implementation
```typescript
// Add to API to get popular filter combinations
router.get('/products/filter-suggestions', async (req, res) => {
  // Analyze common attribute value combinations
  const suggestions = await database.raw(`
    SELECT 
      pa1.attribute_id as attr1_id,
      pa1.value as attr1_value,
      pa2.attribute_id as attr2_id,
      pa2.value as attr2_value,
      COUNT(DISTINCT pa1.product_id) as product_count
    FROM product_attributes pa1
    JOIN product_attributes pa2 ON pa1.product_id = pa2.product_id
    WHERE pa1.attribute_id < pa2.attribute_id
    GROUP BY pa1.attribute_id, pa1.value, pa2.attribute_id, pa2.value
    HAVING COUNT(DISTINCT pa1.product_id) > 5
    ORDER BY product_count DESC
    LIMIT 10
  `);
  
  res.json({ data: suggestions });
});
```

## Implementation Phases

### Phase 1: Basic Filtering (Week 1)
- [ ] Update `usable_in_filter` field for existing attributes
- [ ] Implement backend filtering logic
- [ ] Create basic filter UI component
- [ ] Integrate with ProductTable

### Phase 2: Advanced Filters (Week 2)
- [ ] Implement type-specific filter components
- [ ] Add filter options endpoint
- [ ] Create filter presets/saved filters
- [ ] Add bulk filter operations

### Phase 3: Performance & UX (Week 3)
- [ ] Implement caching strategy
- [ ] Add filter suggestions
- [ ] Create filter templates
- [ ] Add export with filters

### Phase 4: Advanced Features (Week 4)
- [ ] Complex filter combinations (AND/OR)
- [ ] Filter by attribute groups
- [ ] Visual filter builder
- [ ] Filter analytics

## Testing Strategy

### Unit Tests
```typescript
describe('Attribute Filtering', () => {
  it('should filter products by single attribute', async () => {
    const result = await getProductIdsByAttributeFilter(
      1, // color attribute
      { _eq: 'red' },
      { database, logger }
    );
    expect(result).toContain('product-1-id');
  });
  
  it('should handle multiple attribute filters', async () => {
    const filters = {
      attr_color: { _eq: 'red' },
      attr_size: { _in: ['M', 'L'] }
    };
    // Test implementation
  });
});
```

### Integration Tests
- Test filter combinations with sorting
- Test performance with large datasets
- Test filter persistence across sessions
- Test export functionality with filters

## Migration Guide

### For Existing Installations
1. Run migration to add `usable_in_filter` to attributes table (if not exists)
2. Update existing attributes to set `usable_in_filter = true` where appropriate
3. Deploy new API endpoints
4. Update frontend components
5. Test with sample data

### SQL Migration
```sql
-- Add usable_in_filter column if not exists
ALTER TABLE attributes 
ADD COLUMN IF NOT EXISTS usable_in_filter BOOLEAN DEFAULT false;

-- Set filterable for common attributes
UPDATE attributes 
SET usable_in_filter = true 
WHERE code IN ('color', 'size', 'brand', 'material', 'category');
```

## Security Considerations

1. **Input Validation**: Validate all filter operators and values
2. **SQL Injection**: Use parameterized queries via ItemsService
3. **Performance**: Limit number of concurrent filters
4. **Access Control**: Respect Directus permissions for filtered data

## Future Enhancements

1. **AI-Powered Filters**: Use ML to suggest relevant filters
2. **Visual Filter Builder**: Drag-and-drop filter creation
3. **Filter Analytics**: Track popular filter combinations
4. **Cross-Collection Filters**: Filter products by related data
5. **Real-time Filter Updates**: WebSocket-based filter synchronization

## Conclusion

This plan provides a comprehensive, scalable solution for filtering and sorting dynamic attributes in the Product Grid layout. By leveraging existing database fields and following Directus patterns, we ensure compatibility and maintainability while providing a powerful user experience.