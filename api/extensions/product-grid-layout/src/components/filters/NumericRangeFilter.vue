<template>
  <div class="numeric-range-filter">
    <div class="range-inputs">
      <v-input
        v-model="minValue"
        type="number"
        :placeholder="t('min_value')"
        :step="step"
        @update:model-value="updateFilter"
      />
      <span class="separator">—</span>
      <v-input
        v-model="maxValue"
        type="number"
        :placeholder="t('max_value')"
        :step="step"
        @update:model-value="updateFilter"
      />
    </div>
    
    <div v-if="showAdvanced" class="advanced-options">
      <v-select
        v-model="operator"
        :items="operators"
        :placeholder="t('or_use_operator')"
        @update:model-value="onOperatorChange"
      />
      
      <v-input
        v-if="operator && !isRangeOperator"
        v-model="singleValue"
        type="number"
        :placeholder="t('enter_value')"
        :step="step"
        @update:model-value="updateSingleValue"
      />
    </div>
    
    <v-button 
      x-small 
      secondary 
      @click="showAdvanced = !showAdvanced"
    >
      {{ showAdvanced ? t('hide_advanced') : t('show_advanced') }}
    </v-button>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { createI18nOptions } from '../../translations';
import { useStores } from '@directus/extensions-sdk';

const props = defineProps({
  modelValue: {
    type: Object,
    default: null
  },
  attribute: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['update:modelValue']);

const { useSettingsStore } = useStores();
const settingsStore = useSettingsStore();
const currentLanguage = computed(() => settingsStore.settings?.default_language || 'en-US');
const { t } = useI18n(createI18nOptions(currentLanguage.value));

const minValue = ref(null);
const maxValue = ref(null);
const singleValue = ref(null);
const operator = ref(null);
const showAdvanced = ref(false);

// Determine step based on attribute type
const step = computed(() => {
  if (props.attribute.input_interface === 'price') {
    return 0.01;
  }
  return 1;
});

const operators = [
  { text: t('equals'), value: '_eq' },
  { text: t('not_equals'), value: '_neq' },
  { text: t('greater_than'), value: '_gt' },
  { text: t('greater_or_equal'), value: '_gte' },
  { text: t('less_than'), value: '_lt' },
  { text: t('less_or_equal'), value: '_lte' },
  { text: t('between'), value: '_between' },
  { text: t('not_between'), value: '_nbetween' }
];

const isRangeOperator = computed(() => 
  operator.value === '_between' || operator.value === '_nbetween'
);

// Watch for external changes to modelValue
watch(() => props.modelValue, (newVal) => {
  console.log('[NumericRangeFilter] modelValue changed:', newVal, 'for attribute:', props.attribute?.code);
  
  if (!newVal) {
    minValue.value = null;
    maxValue.value = null;
    operator.value = null;
    singleValue.value = null;
    showAdvanced.value = false;
  } else {
    if (newVal._and && Array.isArray(newVal._and)) {
      // Range filter
      const filters = newVal._and;
      const gteFilter = filters.find(f => f._gte !== undefined);
      const lteFilter = filters.find(f => f._lte !== undefined);
      
      if (gteFilter) minValue.value = gteFilter._gte;
      if (lteFilter) maxValue.value = lteFilter._lte;
      
      // Clear operator mode
      operator.value = null;
      singleValue.value = null;
    } else {
      // Single operator
      const op = Object.keys(newVal)[0];
      operator.value = op;
      singleValue.value = newVal[op];
      showAdvanced.value = true;
      
      // Clear range mode
      minValue.value = null;
      maxValue.value = null;
    }
  }
}, { deep: true, immediate: true });

function updateFilter() {
  // Clear operator mode when using range inputs
  if (minValue.value !== null || maxValue.value !== null) {
    operator.value = null;
    singleValue.value = null;
  }

  if (minValue.value === null && maxValue.value === null) {
    emit('update:modelValue', null);
    return;
  }

  const conditions = [];
  if (minValue.value !== null) {
    conditions.push({ _gte: Number(minValue.value) });
  }
  if (maxValue.value !== null) {
    conditions.push({ _lte: Number(maxValue.value) });
  }

  if (conditions.length === 1) {
    emit('update:modelValue', conditions[0]);
  } else {
    emit('update:modelValue', { _and: conditions });
  }
}

function onOperatorChange() {
  // Clear range inputs when using operator mode
  minValue.value = null;
  maxValue.value = null;
  
  if (isRangeOperator.value) {
    // Reset to range mode for between operators
    operator.value = null;
    showAdvanced.value = false;
  } else {
    updateSingleValue();
  }
}

function updateSingleValue() {
  if (!operator.value || singleValue.value === null) {
    emit('update:modelValue', null);
    return;
  }

  emit('update:modelValue', { [operator.value]: Number(singleValue.value) });
}

// Watch for external changes
watch(() => props.modelValue, (newVal) => {
  if (!newVal) {
    minValue.value = null;
    maxValue.value = null;
    singleValue.value = null;
    operator.value = null;
  }
}, { deep: true });
</script>

<style scoped>
.numeric-range-filter {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.range-inputs {
  display: flex;
  align-items: center;
  gap: 8px;
}

.separator {
  color: var(--foreground-subdued);
  font-weight: 500;
}

.advanced-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--background-subdued);
  border-radius: var(--border-radius);
}
</style>