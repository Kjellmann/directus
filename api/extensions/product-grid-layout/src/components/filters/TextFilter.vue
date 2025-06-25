<template>
  <div class="text-filter">
    <v-select
      v-model="operator"
      :items="operators"
      :placeholder="t('select_operator')"
      @update:model-value="updateFilter"
    />
    
    <v-input
      v-if="operator && operator !== '_empty' && operator !== '_nempty'"
      v-model="value"
      :placeholder="t('enter_value')"
      @update:model-value="updateFilter"
    />
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

const operators = [
  { text: t('contains'), value: '_contains' },
  { text: t('not_contains'), value: '_ncontains' },
  { text: t('starts_with'), value: '_starts_with' },
  { text: t('ends_with'), value: '_ends_with' },
  { text: t('equals'), value: '_eq' },
  { text: t('not_equals'), value: '_neq' },
  { text: t('is_empty'), value: '_empty' },
  { text: t('is_not_empty'), value: '_nempty' }
];

// Initialize from modelValue
const operator = ref(null);
const value = ref('');

if (props.modelValue) {
  const op = Object.keys(props.modelValue)[0];
  operator.value = op;
  if (op !== '_empty' && op !== '_nempty') {
    value.value = props.modelValue[op];
  }
}

function updateFilter() {
  if (!operator.value) {
    emit('update:modelValue', null);
    return;
  }

  if (operator.value === '_empty' || operator.value === '_nempty') {
    emit('update:modelValue', { [operator.value]: true });
  } else if (value.value) {
    emit('update:modelValue', { [operator.value]: value.value });
  } else {
    emit('update:modelValue', null);
  }
}

// Watch for external changes
watch(() => props.modelValue, (newVal) => {
  if (!newVal) {
    operator.value = null;
    value.value = '';
  } else {
    const op = Object.keys(newVal)[0];
    operator.value = op;
    if (op !== '_empty' && op !== '_nempty') {
      value.value = newVal[op];
    }
  }
}, { deep: true });
</script>

<style scoped>
.text-filter {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>