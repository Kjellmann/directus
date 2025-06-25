<template>
	<div class="select-filter-enhanced">
		<div v-if="hasOperatorMode" class="filter-mode">
			<v-checkbox v-model="useOperatorMode" :label="t('use_advanced_operators')" />
		</div>

		<template v-if="!useOperatorMode">
			<!-- Search mode for large datasets -->
			<template v-if="useSearchMode">
				<v-input
					v-model="searchQuery"
					:placeholder="t('search_options')"
					@update:model-value="debouncedSearch"
					:loading="loading"
				>
					<template #prepend>
						<v-icon name="search" />
					</template>
				</v-input>

				<div class="search-results" v-if="searchQuery || selectedValues.length > 0">
					<!-- Show selected values first -->
					<div v-if="selectedValues.length > 0" class="selected-section">
						<div class="section-header">{{ t('selected') }} ({{ selectedValues.length }})</div>
						<v-checkbox
							v-for="value in selectedValues"
							:key="value"
							:model-value="true"
							:label="getValueLabel(value)"
							@update:model-value="(checked) => toggleValue(value, checked)"
						/>
					</div>

					<!-- Show search results -->
					<div v-if="filteredOptions.length > 0" class="results-section">
						<div class="section-header" v-if="selectedValues.length > 0">
							{{ t('search_results') }} ({{ totalCount }})
						</div>
						<v-checkbox
							v-for="option in filteredOptions"
							:key="option.value"
							:model-value="selectedValues.includes(option.value)"
							:label="option.text"
							@update:model-value="(checked) => toggleValue(option.value, checked)"
						/>
						
						<!-- Load more button -->
						<v-button
							v-if="hasMore && !loading"
							secondary
							small
							full-width
							@click="loadMore"
						>
							{{ t('load_more') }}
						</v-button>
					</div>

					<div v-else-if="!loading && searchQuery" class="no-results">
						{{ t('no_results_found') }}
					</div>
				</div>
			</template>

			<!-- Standard dropdown for small datasets -->
			<v-select
				v-else
				v-model="selectedValues"
				:items="options"
				:placeholder="t('select_values')"
				multiple
				:search="options && options.length > 10 ? { fields: ['text'] } : undefined"
				:allow-other="false"
				:allow-none="true"
				:show-deselect="selectedValues.length > 0"
				:loading="loading"
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

			<template v-if="operator && requiresValue">
				<!-- Use search mode for operators with large datasets -->
				<template v-if="useSearchMode">
					<v-input
						v-model="operatorSearchQuery"
						:placeholder="t('search_value')"
						@update:model-value="debouncedOperatorSearch"
						:loading="loading"
					>
						<template #prepend>
							<v-icon name="search" />
						</template>
					</v-input>

					<div class="search-results single-select" v-if="operatorSearchQuery || operatorValue">
						<v-radio
							v-for="option in filteredOptions"
							:key="option.value"
							:model-value="operatorValue"
							:value="option.value"
							:label="option.text"
							@update:model-value="updateOperatorValue"
						/>
					</div>
				</template>

				<v-select
					v-else
					v-model="operatorValue"
					:items="options"
					:placeholder="t('select_value')"
					:multiple="operator === '_in' || operator === '_nin'"
					:search="options && options.length > 10 ? { fields: ['text'] } : undefined"
					:allow-other="false"
					:show-deselect="true"
					:loading="loading"
					@update:model-value="updateOperatorFilter"
				/>
			</template>
		</template>
	</div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from 'vue-i18n';
import { createI18nOptions } from '../../translations';
import { useStores } from '@directus/extensions-sdk';
import { useFilterOptions } from '../../composables/useFilterOptions';
// Simple debounce implementation
function debounce(func, wait) {
	let timeout;
	return function executedFunction(...args) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

const props = defineProps({
	modelValue: {
		type: Object,
		default: null,
	},
	attribute: {
		type: Object,
		required: true,
	},
	// Optional pre-loaded options for backward compatibility
	options: {
		type: Array,
		default: null,
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

// Use the new composable for lazy loading
const { loadOptions, getOptionsRef, getLoadingRef, getTotalCountRef, shouldUseSearch, getOptionLabel } = useFilterOptions({
	threshold: 25, // Use search if more than 25 options
	pageSize: 25,
});

// Component state
const selectedValues = ref([]);
const operator = ref(null);
const operatorValue = ref(null);
const useOperatorMode = ref(false);
const searchQuery = ref('');
const operatorSearchQuery = ref('');
const currentPage = ref(1);
const hasMore = ref(false);

// Get reactive refs from composable
const lazyOptions = getOptionsRef(props.attribute.code);
const lazyLoading = getLoadingRef(props.attribute.code);
const totalCount = getTotalCountRef(props.attribute.code);

// Use provided options or lazy-loaded options
const options = computed(() => props.options || lazyOptions.value);
const loading = computed(() => props.loading || lazyLoading.value);

// Check if should use search mode
const useSearchMode = ref(false);

// Filtered options based on search
const filteredOptions = computed(() => {
	if (!searchQuery.value && !operatorSearchQuery.value) {
		return options.value.filter(opt => !selectedValues.value.includes(opt.value));
	}
	// Search results are already filtered by the API
	return options.value;
});

const isMultiSelect = computed(
	() =>
		props.attribute.input_interface === 'multi_select' ||
		props.attribute.input_interface === 'reference_entity_multiple'
);

const hasOperatorMode = computed(
	() =>
		props.attribute.input_interface === 'simple_select' ||
		props.attribute.input_interface === 'reference_entity_single'
);

const operators = computed(() => [
	{ text: t('equals'), value: '_eq' },
	{ text: t('not_equals'), value: '_neq' },
	{ text: t('in'), value: '_in' },
	{ text: t('not_in'), value: '_nin' },
	{ text: t('is_empty'), value: '_empty' },
	{ text: t('is_not_empty'), value: '_nempty' },
]);

const requiresValue = computed(() => operator.value && operator.value !== '_empty' && operator.value !== '_nempty');

// Methods
function getValueLabel(value) {
	const option = options.value.find(opt => opt.value === value);
	if (option) return option.text;
	
	// Try to get from composable cache (for values not in current page)
	return getOptionLabel(props.attribute.code, value);
}

function toggleValue(value, checked) {
	if (checked) {
		selectedValues.value = [...selectedValues.value, value];
	} else {
		selectedValues.value = selectedValues.value.filter(v => v !== value);
	}
	updateMultiSelect();
}

function updateMultiSelect() {
	if (!selectedValues.value || selectedValues.value.length === 0) {
		emit('update:modelValue', null);
	} else {
		emit('update:modelValue', { _in: selectedValues.value });
	}
}

function updateOperatorValue(value) {
	operatorValue.value = value;
	updateOperatorFilter();
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

async function performSearch(isOperatorSearch = false) {
	const query = isOperatorSearch ? operatorSearchQuery.value : searchQuery.value;
	currentPage.value = 1;
	
	const result = await loadOptions(props.attribute.code, query, 1, false);
	hasMore.value = result.hasMore;
}

async function loadMore() {
	currentPage.value++;
	const result = await loadOptions(props.attribute.code, searchQuery.value, currentPage.value, true);
	hasMore.value = result.hasMore;
}

// Debounced search functions
const debouncedSearch = debounce(() => performSearch(false), 300);
const debouncedOperatorSearch = debounce(() => performSearch(true), 300);

// Initialize on mount
onMounted(async () => {
	// Only load options if not provided via props
	if (!props.options) {
		const result = await loadOptions(props.attribute.code, '', 1, false);
		useSearchMode.value = result.useSearch;
		hasMore.value = result.hasMore;
		
		// If not in search mode, load all options
		if (!result.useSearch && result.hasMore) {
			// Load remaining pages
			let page = 2;
			while (result.hasMore) {
				const nextResult = await loadOptions(props.attribute.code, '', page, true);
				if (!nextResult.hasMore) break;
				page++;
			}
		}
	} else {
		// Check if should use search based on provided options
		useSearchMode.value = props.options.length > 25;
	}
});

// Watch for mode changes
watch(useOperatorMode, (newVal) => {
	if (!newVal) {
		operator.value = null;
		operatorValue.value = null;
		selectedValues.value = [];
		emit('update:modelValue', null);
	} else {
		selectedValues.value = [];
	}
});

// Watch for external changes to modelValue
watch(
	() => props.modelValue,
	(newVal) => {
		if (!newVal) {
			selectedValues.value = [];
			operator.value = null;
			operatorValue.value = null;
			useOperatorMode.value = false;
		} else {
			const op = Object.keys(newVal)[0];

			if (op === '_in') {
				selectedValues.value = newVal._in || [];
				useOperatorMode.value = false;
				operator.value = null;
				operatorValue.value = null;
			} else if (op === '_eq' && !hasOperatorMode.value) {
				selectedValues.value = [newVal._eq];
				useOperatorMode.value = false;
			} else if (hasOperatorMode.value && op) {
				useOperatorMode.value = true;
				operator.value = op;
				if (requiresValue.value) {
					operatorValue.value = newVal[op];
				}
			} else {
				if (op === '_eq') {
					selectedValues.value = [newVal._eq];
				}
				useOperatorMode.value = false;
			}
		}
	},
	{ deep: true, immediate: true }
);
</script>

<style scoped>
.select-filter-enhanced {
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.filter-mode {
	padding: 8px 0;
	border-bottom: 1px solid var(--border-subdued);
}

.search-results {
	margin-top: 8px;
	max-height: 300px;
	overflow-y: auto;
	border: 1px solid var(--border-normal);
	border-radius: var(--border-radius);
	background-color: var(--background-page);
}

.search-results.single-select {
	max-height: 200px;
}

.selected-section,
.results-section {
	padding: 8px;
}

.selected-section {
	background-color: var(--background-highlight);
	border-bottom: 1px solid var(--border-subdued);
}

.section-header {
	font-size: 12px;
	font-weight: 600;
	color: var(--foreground-subdued);
	text-transform: uppercase;
	margin-bottom: 8px;
	letter-spacing: 0.05em;
}

.no-results {
	padding: 16px;
	text-align: center;
	color: var(--foreground-subdued);
}

.v-checkbox,
.v-radio {
	display: block;
	margin-bottom: 4px;
}

.v-checkbox:last-child,
.v-radio:last-child {
	margin-bottom: 0;
}

.v-button {
	margin-top: 8px;
}
</style>