<template>
	<div class="select-filter">
		<div v-if="hasOperatorMode" class="filter-mode">
			<v-checkbox v-model="useOperatorMode" :label="t('use_advanced_operators')" />
		</div>

		<template v-if="!useOperatorMode">
			<v-select
				v-model="selectedValues"
				:items="options"
				:placeholder="t('select_values')"
				multiple
				:search="options && options.length > 10 ? { fields: ['text'] } : undefined"
				:allow-other="false"
				:allow-none="true"
				:show-deselect="selectedValues.length > 0"
				@update:model-value="updateMultiSelect"
			/>
		</template>

		<template v-else>
			<!-- Advanced operator mode -->
			<v-select
				v-model="operator"
				:items="operators"
				:placeholder="t('select_operator')"
				@update:model-value="updateOperatorFilter"
			/>

			<v-select
				v-if="operator && requiresValue"
				v-model="operatorValue"
				:items="options"
				:placeholder="t('select_value')"
				:multiple="operator === '_in' || operator === '_nin'"
				:search="options && options.length > 10 ? { fields: ['text'] } : undefined"
				:allow-other="false"
				:show-deselect="true"
				@update:model-value="updateOperatorFilter"
			/>
		</template>

		<div v-if="loading" class="loading">
			<v-progress-circular indeterminate />
		</div>
	</div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { createI18nOptions } from '../../translations';
import { useStores } from '@directus/extensions-sdk';

const props = defineProps({
	modelValue: {
		type: Object,
		default: null,
	},
	attribute: {
		type: Object,
		required: true,
	},
	options: {
		type: Array,
		default: () => [],
	},
	loading: {
		type: Boolean,
		default: false,
	},
});

const emit = defineEmits(['update:modelValue']);

const { useSettingsStore } = useStores();
const settingsStore = useSettingsStore();
const currentLanguage = computed(() => settingsStore.settings?.default_language || 'en-US');
const { t } = useI18n(createI18nOptions(currentLanguage.value));

const selectedValues = ref([]);
const operator = ref(null);
const operatorValue = ref(null);
const useOperatorMode = ref(false);

const isMultiSelect = computed(
	() =>
		props.attribute.input_interface === 'multi_select' ||
		props.attribute.input_interface === 'reference_entity_multiple',
);

const hasOperatorMode = computed(
	() =>
		props.attribute.input_interface === 'simple_select' ||
		props.attribute.input_interface === 'reference_entity_single',
);

const operators = computed(() => {
	const ops = [
		{ text: t('equals'), value: '_eq' },
		{ text: t('not_equals'), value: '_neq' },
		{ text: t('in'), value: '_in' },
		{ text: t('not_in'), value: '_nin' },
		{ text: t('is_empty'), value: '_empty' },
		{ text: t('is_not_empty'), value: '_nempty' },
	];

	return ops;
});

const requiresValue = computed(() => operator.value && operator.value !== '_empty' && operator.value !== '_nempty');

function updateMultiSelect() {
	if (!selectedValues.value || selectedValues.value.length === 0) {
		emit('update:modelValue', null);
	} else if (selectedValues.value.length === props.options.length && !props.attribute?.is_system_field) {
		// For non-system fields: If all options are selected, don't apply any filter
		emit('update:modelValue', null);
	} else {
		// Always apply filter for system fields or when not all options are selected
		emit('update:modelValue', { _in: selectedValues.value });
	}
}

function updateOperatorFilter() {
	if (!operator.value) {
		emit('update:modelValue', null);
		return;
	}

	if (operator.value === '_empty' || operator.value === '_nempty') {
		emit('update:modelValue', { [operator.value]: true });
	} else if (operatorValue.value) {
		emit('update:modelValue', { [operator.value]: operatorValue.value });
	} else {
		emit('update:modelValue', null);
	}
}

// Watch for mode changes
watch(useOperatorMode, (newVal) => {
	if (!newVal) {
		// Reset to simple mode
		operator.value = null;
		operatorValue.value = null;
		selectedValues.value = [];
		emit('update:modelValue', null);
	} else {
		// Reset simple mode values
		selectedValues.value = [];
	}
});

// Watch for external changes to modelValue
watch(
	() => props.modelValue,
	(newVal) => {
		console.log('[SelectFilter] modelValue changed:', newVal, 'for attribute:', props.attribute?.code);

		if (!newVal) {
			selectedValues.value = [];
			operator.value = null;
			operatorValue.value = null;
			useOperatorMode.value = false;
		} else {
			// Re-initialize from the new value
			const op = Object.keys(newVal)[0];

			if (op === '_in') {
				// For _in operator, use simple multi-select mode
				selectedValues.value = newVal._in || [];
				useOperatorMode.value = false;
				operator.value = null;
				operatorValue.value = null;
			} else if (op === '_eq' && !hasOperatorMode.value) {
				// Simple mode with single value - convert to array for multi-select
				selectedValues.value = [newVal._eq];
				useOperatorMode.value = false;
			} else if (hasOperatorMode.value && op) {
				// Only use operator mode if this field type supports it
				useOperatorMode.value = true;
				operator.value = op;
				if (requiresValue.value) {
					operatorValue.value = newVal[op];
				}
			} else {
				// Default to simple mode
				if (op === '_eq') {
					selectedValues.value = [newVal._eq];
				}
				useOperatorMode.value = false;
			}
		}
	},
	{ deep: true, immediate: true },
);
</script>

<style scoped>
.select-filter {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.filter-mode {
	padding: 8px 0;
	border-bottom: 1px solid var(--border-subdued);
}

.loading {
	display: flex;
	justify-content: center;
	padding: 20px;
}
</style>
