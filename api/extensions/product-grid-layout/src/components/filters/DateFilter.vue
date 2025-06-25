<template>
  <div class="date-filter">
    <v-select
      v-model="mode"
      :items="modes"
      :placeholder="t('select_date_mode')"
      @update:model-value="onModeChange"
    />
    
    <!-- Relative date options -->
    <v-select
      v-if="mode === 'relative'"
      v-model="relativeOption"
      :items="relativeOptions"
      :placeholder="t('select_period')"
      @update:model-value="updateRelativeFilter"
    />
    
    <!-- Specific date range -->
    <div v-else-if="mode === 'specific'" class="date-inputs">
      <interface-datetime
        v-model="startDate"
        type="date"
        :placeholder="t('from_date')"
        @update:model-value="updateSpecificFilter"
      />
      <span class="separator">—</span>
      <interface-datetime
        v-model="endDate"
        type="date"
        :placeholder="t('to_date')"
        @update:model-value="updateSpecificFilter"
      />
    </div>
    
    <!-- Advanced operators -->
    <div v-else-if="mode === 'advanced'" class="advanced-options">
      <v-select
        v-model="operator"
        :items="dateOperators"
        :placeholder="t('select_operator')"
        @update:model-value="updateAdvancedFilter"
      />
      
      <interface-datetime
        v-if="operator && operator !== '_empty' && operator !== '_nempty'"
        v-model="singleDate"
        type="date"
        :placeholder="t('select_date')"
        @update:model-value="updateAdvancedFilter"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
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

const mode = ref('relative');
const relativeOption = ref(null);
const startDate = ref(null);
const endDate = ref(null);
const operator = ref(null);
const singleDate = ref(null);

const modes = [
  { text: t('relative_date'), value: 'relative' },
  { text: t('specific_dates'), value: 'specific' },
  { text: t('advanced'), value: 'advanced' }
];

const relativeOptions = [
  { text: t('today'), value: 'today' },
  { text: t('yesterday'), value: 'yesterday' },
  { text: t('this_week'), value: 'this_week' },
  { text: t('last_week'), value: 'last_week' },
  { text: t('this_month'), value: 'this_month' },
  { text: t('last_month'), value: 'last_month' },
  { text: t('last_7_days'), value: 'last_7_days' },
  { text: t('last_30_days'), value: 'last_30_days' },
  { text: t('last_90_days'), value: 'last_90_days' },
  { text: t('this_year'), value: 'this_year' },
  { text: t('last_year'), value: 'last_year' }
];

const dateOperators = [
  { text: t('equals'), value: '_eq' },
  { text: t('not_equals'), value: '_neq' },
  { text: t('before'), value: '_lt' },
  { text: t('before_or_on'), value: '_lte' },
  { text: t('after'), value: '_gt' },
  { text: t('after_or_on'), value: '_gte' },
  { text: t('is_empty'), value: '_empty' },
  { text: t('is_not_empty'), value: '_nempty' }
];

function onModeChange() {
  // Clear all values when mode changes
  relativeOption.value = null;
  startDate.value = null;
  endDate.value = null;
  operator.value = null;
  singleDate.value = null;
  emit('update:modelValue', null);
}

function updateRelativeFilter() {
  if (!relativeOption.value) {
    emit('update:modelValue', null);
    return;
  }

  const now = new Date();
  let start, end;

  switch (relativeOption.value) {
    case 'today':
      start = new Date(now.setHours(0, 0, 0, 0));
      end = new Date(now.setHours(23, 59, 59, 999));
      break;
    case 'yesterday':
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      start = new Date(yesterday.setHours(0, 0, 0, 0));
      end = new Date(yesterday.setHours(23, 59, 59, 999));
      break;
    case 'this_week':
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      start = new Date(weekStart.setHours(0, 0, 0, 0));
      end = new Date();
      break;
    case 'last_week':
      const lastWeekEnd = new Date(now);
      lastWeekEnd.setDate(now.getDate() - now.getDay() - 1);
      const lastWeekStart = new Date(lastWeekEnd);
      lastWeekStart.setDate(lastWeekStart.getDate() - 6);
      start = new Date(lastWeekStart.setHours(0, 0, 0, 0));
      end = new Date(lastWeekEnd.setHours(23, 59, 59, 999));
      break;
    case 'this_month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date();
      break;
    case 'last_month':
      const lastMonth = new Date(now);
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      start = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
      end = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0, 23, 59, 59, 999);
      break;
    case 'last_7_days':
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      end = new Date();
      break;
    case 'last_30_days':
      start = new Date(now);
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      end = new Date();
      break;
    case 'last_90_days':
      start = new Date(now);
      start.setDate(start.getDate() - 90);
      start.setHours(0, 0, 0, 0);
      end = new Date();
      break;
    case 'this_year':
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date();
      break;
    case 'last_year':
      start = new Date(now.getFullYear() - 1, 0, 1);
      end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
      break;
  }

  emit('update:modelValue', {
    _and: [
      { _gte: start.toISOString() },
      { _lte: end.toISOString() }
    ]
  });
}

function updateSpecificFilter() {
  if (!startDate.value && !endDate.value) {
    emit('update:modelValue', null);
    return;
  }

  const conditions = [];
  if (startDate.value) {
    conditions.push({ _gte: startDate.value });
  }
  if (endDate.value) {
    conditions.push({ _lte: endDate.value });
  }

  if (conditions.length === 1) {
    emit('update:modelValue', conditions[0]);
  } else {
    emit('update:modelValue', { _and: conditions });
  }
}

function updateAdvancedFilter() {
  if (!operator.value) {
    emit('update:modelValue', null);
    return;
  }

  if (operator.value === '_empty' || operator.value === '_nempty') {
    emit('update:modelValue', { [operator.value]: true });
  } else if (singleDate.value) {
    emit('update:modelValue', { [operator.value]: singleDate.value });
  } else {
    emit('update:modelValue', null);
  }
}

// Initialize from modelValue
if (props.modelValue) {
  if (props.modelValue._and && Array.isArray(props.modelValue._and)) {
    mode.value = 'specific';
    const filters = props.modelValue._and;
    const gteFilter = filters.find(f => f._gte !== undefined);
    const lteFilter = filters.find(f => f._lte !== undefined);
    
    if (gteFilter) startDate.value = gteFilter._gte;
    if (lteFilter) endDate.value = lteFilter._lte;
  } else {
    mode.value = 'advanced';
    const op = Object.keys(props.modelValue)[0];
    operator.value = op;
    if (op !== '_empty' && op !== '_nempty') {
      singleDate.value = props.modelValue[op];
    }
  }
}
</script>

<style scoped>
.date-filter {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.date-inputs {
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
}
</style>