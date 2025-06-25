<template>
  <div class="boolean-filter">
    <v-select
      v-model="value"
      :items="options"
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

const value = ref('any');

const options = [
  { text: t('any'), value: 'any' },
  { text: t('yes'), value: 'yes' },
  { text: t('no'), value: 'no' }
];

function updateFilter() {
  switch (value.value) {
    case 'yes':
      emit('update:modelValue', { _eq: true });
      break;
    case 'no':
      emit('update:modelValue', { _eq: false });
      break;
    default:
      emit('update:modelValue', null);
  }
}

// Watch for external changes
watch(() => props.modelValue, (newVal) => {
  console.log('[BooleanFilter] modelValue changed:', newVal, 'for attribute:', props.attribute?.code);
  
  if (!newVal) {
    value.value = 'any';
  } else if (newVal._eq === true) {
    value.value = 'yes';
  } else if (newVal._eq === false) {
    value.value = 'no';
  }
}, { deep: true, immediate: true });
</script>

<style scoped>
.boolean-filter {
  padding: 8px 0;
}
</style>