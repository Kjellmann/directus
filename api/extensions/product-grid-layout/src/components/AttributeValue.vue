<template>
  <div class="attribute-value">
    <template v-if="value === null || value === undefined">
      <span class="null-value">-</span>
    </template>
    
    <template v-else-if="attribute?.type?.input_interface === 'yes_no'">
      <v-icon :name="value ? 'check' : 'close'" :class="{ positive: value, negative: !value }" />
    </template>
    
    <template v-else-if="attribute?.type?.input_interface === 'price'">
      <span class="price">{{ formatPrice(value) }}</span>
    </template>
    
    <template v-else-if="attribute?.type?.input_interface === 'date'">
      <span>{{ formatDate(value) }}</span>
    </template>
    
    <template v-else-if="attribute?.type?.input_interface === 'simple_select'">
      <v-chip small>{{ getOptionLabel(value) }}</v-chip>
    </template>
    
    <template v-else-if="attribute?.type?.input_interface === 'multi_select'">
      <div class="chips">
        <v-chip v-for="val in value" :key="val" small>
          {{ getOptionLabel(val) }}
        </v-chip>
      </div>
    </template>
    
    <template v-else-if="attribute?.type?.input_interface === 'image'">
      <img v-if="value" :src="getThumbnail(value)" class="thumbnail" />
    </template>
    
    <template v-else-if="attribute?.type?.input_interface === 'table'">
      <span class="complex-value">{{ Array.isArray(value) ? `${value.length} rows` : 'Invalid data' }}</span>
    </template>
    
    <template v-else>
      <span>{{ formatValue(value) }}</span>
    </template>
  </div>
</template>

<script setup lang="ts">
interface Props {
  value: any;
  attribute?: any;
}

const props = defineProps<Props>();

const formatPrice = (value: number) => {
  if (typeof value !== 'number') return value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
};

const formatDate = (value: string) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString();
};

const formatValue = (value: any) => {
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
};

const getOptionLabel = (code: string) => {
  if (!props.attribute?.options) return code;
  const option = props.attribute.options.find((opt: any) => opt.code === code);
  return option?.label || code;
};

const getThumbnail = (fileId: string) => {
  return `/assets/${fileId}?width=40&height=40&fit=cover`;
};
</script>

<style scoped>
.attribute-value {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.null-value {
  color: var(--foreground-subdued);
}

.positive {
  color: var(--success);
}

.negative {
  color: var(--danger);
}

.price {
  font-family: var(--family-monospace);
}

.chips {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.thumbnail {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: var(--border-radius);
}

.complex-value {
  color: var(--foreground-subdued);
  font-style: italic;
}
</style>