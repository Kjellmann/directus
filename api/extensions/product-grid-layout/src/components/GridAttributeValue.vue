<template>
  <div class="grid-attribute-value" :class="valueClass">
    <!-- Null/Empty Value -->
    <template v-if="isEmpty">
      <span class="null-value">-</span>
    </template>
    
    <!-- Boolean/Yes-No -->
    <template v-else-if="inputInterface === 'yes_no'">
      <div class="boolean-value">
        <v-icon 
          :name="displayValue ? 'check_circle' : 'cancel'" 
          :class="{ 'yes': displayValue, 'no': !displayValue }"
          small
        />
        <span>{{ displayValue ? 'Yes' : 'No' }}</span>
      </div>
    </template>
    
    <!-- Price/Metric -->
    <template v-else-if="inputInterface === 'price' || inputInterface === 'metric'">
      <div class="metric-value">
        <span class="value">{{ formatNumber(displayValue) }}</span>
        <span v-if="unit" class="unit">{{ unit }}</span>
      </div>
    </template>
    
    <!-- Date -->
    <template v-else-if="inputInterface === 'date'">
      <span class="date-value">{{ formatDate(displayValue) }}</span>
    </template>
    
    <!-- Simple Select -->
    <template v-else-if="inputInterface === 'simple_select' && attribute?.options">
      <v-chip small>
        {{ getOptionLabel(displayValue) }}
      </v-chip>
    </template>
    
    <!-- Multi Select -->
    <template v-else-if="inputInterface === 'multi_select' && attribute?.options">
      <div class="chips-value">
        <v-chip 
          v-for="val in ensureArray(displayValue)" 
          :key="val" 
          x-small
        >
          {{ getOptionLabel(val) }}
        </v-chip>
        <span v-if="ensureArray(displayValue).length > 3" class="more-count">
          +{{ ensureArray(displayValue).length - 3 }}
        </span>
      </div>
    </template>
    
    <!-- Image -->
    <template v-else-if="inputInterface === 'image'">
      <div class="image-value" v-if="displayValue">
        <img 
          :src="getThumbnail(displayValue)" 
          :alt="attribute?.label || 'Image'"
          @error="imageError = true"
        />
      </div>
    </template>
    
    <!-- Table -->
    <template v-else-if="inputInterface === 'table'">
      <div class="table-value">
        <v-icon name="table_chart" small />
        <span>{{ getTableSummary(displayValue) }}</span>
      </div>
    </template>
    
    <!-- Text/Identifier -->
    <template v-else-if="['text', 'identifier'].includes(inputInterface)">
      <span class="text-value" :title="String(displayValue)">
        {{ truncateText(String(displayValue), 50) }}
      </span>
    </template>
    
    <!-- Number -->
    <template v-else-if="inputInterface === 'number'">
      <span class="number-value">{{ formatNumber(displayValue) }}</span>
    </template>
    
    <!-- Default -->
    <template v-else>
      <span class="default-value" :title="String(displayValue)">
        {{ truncateText(String(displayValue), 50) }}
      </span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

interface Props {
  value: any;
  attribute?: any;
}

const props = defineProps<Props>();

const imageError = ref(false);

// Computed
const parsedValue = computed(() => {
  if (!props.value) return null;
  
  try {
    // If it's already an object, return it
    if (typeof props.value === 'object') return props.value;
    
    // Try to parse JSON
    const parsed = JSON.parse(props.value);
    return parsed;
  } catch {
    // Return as-is if not JSON
    return props.value;
  }
});

const displayValue = computed(() => {
  const val = parsedValue.value;
  
  // Handle metric/price values
  if (val && typeof val === 'object' && 'value' in val) {
    return val.value;
  }
  
  return val;
});

const unit = computed(() => {
  const val = parsedValue.value;
  
  if (val && typeof val === 'object' && val.unit) {
    // Find unit label if available
    if (props.attribute?.units) {
      const unitData = props.attribute.units.find((u: any) => u.id === val.unit);
      return unitData?.code || val.unit;
    }
    return val.unit;
  }
  
  return null;
});

const inputInterface = computed(() => {
  return props.attribute?.type?.input_interface || 'text';
});

const isEmpty = computed(() => {
  return displayValue.value === null || 
         displayValue.value === undefined || 
         displayValue.value === '';
});

const valueClass = computed(() => {
  return {
    'is-empty': isEmpty.value,
    'is-boolean': inputInterface.value === 'yes_no',
    'is-metric': ['price', 'metric'].includes(inputInterface.value),
    'is-image': inputInterface.value === 'image',
    'has-error': imageError.value
  };
});

// Methods
const formatNumber = (value: any) => {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  
  // Format based on type
  if (inputInterface.value === 'price') {
    return new Intl.NumberFormat('en-US', {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  }
  
  // Regular number formatting
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    maximumFractionDigits: 2
  }).format(num);
};

const formatDate = (value: string) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return value;
  }
};

const getOptionLabel = (code: string) => {
  if (!props.attribute?.options) return code;
  const option = props.attribute.options.find((opt: any) => opt.code === code);
  return option?.label || code;
};

const ensureArray = (value: any) => {
  if (Array.isArray(value)) return value.slice(0, 3);
  return [value];
};

const getThumbnail = (fileId: string) => {
  if (imageError.value) return '';
  return `/assets/${fileId}?width=40&height=40&fit=cover`;
};

const getTableSummary = (value: any) => {
  if (!Array.isArray(value)) return 'Invalid data';
  if (value.length === 0) return 'No rows';
  return `${value.length} row${value.length !== 1 ? 's' : ''}`;
};

const truncateText = (text: string, maxLength: number) => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};
</script>

<style scoped>
.grid-attribute-value {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
}

.null-value {
  color: var(--foreground-subdued);
  font-style: italic;
}

/* Boolean Values */
.boolean-value {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}

.boolean-value .yes {
  color: var(--success);
}

.boolean-value .no {
  color: var(--foreground-subdued);
}

/* Metric/Price Values */
.metric-value {
  display: flex;
  align-items: baseline;
  gap: 4px;
  font-family: var(--family-monospace);
}

.metric-value .value {
  font-weight: 500;
}

.metric-value .unit {
  font-size: 11px;
  color: var(--foreground-subdued);
}

/* Date Values */
.date-value {
  font-size: 13px;
  color: var(--foreground-normal);
}

/* Chips */
.chips-value {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  max-width: 200px;
}

.chips-value .v-chip {
  max-width: 80px;
}

.more-count {
  font-size: 11px;
  color: var(--foreground-subdued);
  margin-left: 2px;
}

/* Image Values */
.image-value img {
  width: 32px;
  height: 32px;
  object-fit: cover;
  border-radius: var(--border-radius);
  border: 1px solid var(--border-subdued);
}

.image-value.has-error img {
  display: none;
}

/* Table Values */
.table-value {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--foreground-subdued);
  font-size: 13px;
}

/* Text Values */
.text-value,
.default-value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

/* Number Values */
.number-value {
  font-family: var(--family-monospace);
  font-weight: 500;
}
</style>