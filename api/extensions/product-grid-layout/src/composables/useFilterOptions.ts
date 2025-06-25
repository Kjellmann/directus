import { ref, Ref, computed } from 'vue';
import { useApi } from '@directus/extensions-sdk';

interface FilterOption {
	value: any;
	text: string;
}

interface FilterOptionsConfig {
	threshold?: number; // Threshold for switching to search mode
	pageSize?: number; // Number of items per page
	searchDebounce?: number; // Debounce for search in ms
}

const DEFAULT_CONFIG: FilterOptionsConfig = {
	threshold: 25, // Switch to search mode if more than 25 options
	pageSize: 25,
	searchDebounce: 300,
};

// Cache for filter options
const optionsCache: Record<string, {
	options: Ref<FilterOption[]>;
	totalCount: Ref<number>;
	isComplete: Ref<boolean>;
	lastSearch: Ref<string>;
}> = {};

// Loading states
const loadingStates: Record<string, Ref<boolean>> = {};

export function useFilterOptions(config: FilterOptionsConfig = {}) {
	const api = useApi();
	const mergedConfig = { ...DEFAULT_CONFIG, ...config };

	// Get or create cache entry for attribute
	function getCacheEntry(attributeCode: string) {
		if (!optionsCache[attributeCode]) {
			optionsCache[attributeCode] = {
				options: ref([]),
				totalCount: ref(0),
				isComplete: ref(false),
				lastSearch: ref(''),
			};
		}
		if (!loadingStates[attributeCode]) {
			loadingStates[attributeCode] = ref(false);
		}
		return optionsCache[attributeCode];
	}

	// Load initial options or search results
	async function loadOptions(
		attributeCode: string,
		search: string = '',
		page: number = 1,
		append: boolean = false
	): Promise<{
		options: FilterOption[];
		totalCount: number;
		hasMore: boolean;
		useSearch: boolean;
	}> {
		const cache = getCacheEntry(attributeCode);
		const loading = loadingStates[attributeCode];

		// If we have complete data and no search, return cached
		if (cache.isComplete.value && !search && cache.lastSearch.value === '') {
			return {
				options: cache.options.value,
				totalCount: cache.totalCount.value,
				hasMore: false,
				useSearch: false,
			};
		}

		// Skip if already loading
		if (loading.value) {
			return {
				options: cache.options.value,
				totalCount: cache.totalCount.value,
				hasMore: false,
				useSearch: cache.totalCount.value > mergedConfig.threshold!,
			};
		}

		loading.value = true;

		try {
			const response = await api.get('/product-grid/products/filters', {
				params: {
					attribute_code: attributeCode,
					search,
					page,
					limit: mergedConfig.pageSize,
				},
			});

			if (response.data && response.data.data) {
				const newOptions = response.data.data as FilterOption[];
				const totalCount = response.data.meta?.total_count || newOptions.length;
				
				// Update cache
				cache.totalCount.value = totalCount;
				cache.lastSearch.value = search;

				if (append && !search) {
					// Append to existing options (pagination)
					cache.options.value = [...cache.options.value, ...newOptions];
				} else {
					// Replace options (new search or initial load)
					cache.options.value = newOptions;
				}

				// Mark as complete if we've loaded all options
				const loadedCount = cache.options.value.length;
				cache.isComplete.value = !search && loadedCount >= totalCount;

				const hasMore = loadedCount < totalCount;
				const useSearch = totalCount > mergedConfig.threshold!;

				return {
					options: cache.options.value,
					totalCount,
					hasMore,
					useSearch,
				};
			}

			return {
				options: [],
				totalCount: 0,
				hasMore: false,
				useSearch: false,
			};
		} catch (error) {
			console.error(`Failed to load options for ${attributeCode}:`, error);
			return {
				options: cache.options.value,
				totalCount: cache.totalCount.value,
				hasMore: false,
				useSearch: false,
			};
		} finally {
			loading.value = false;
		}
	}

	// Get reactive references
	function getOptionsRef(attributeCode: string) {
		const cache = getCacheEntry(attributeCode);
		return cache.options;
	}

	function getLoadingRef(attributeCode: string) {
		getCacheEntry(attributeCode);
		return loadingStates[attributeCode];
	}

	function getTotalCountRef(attributeCode: string) {
		const cache = getCacheEntry(attributeCode);
		return cache.totalCount;
	}

	// Check if should use search mode
	function shouldUseSearch(attributeCode: string): boolean {
		const cache = getCacheEntry(attributeCode);
		return cache.totalCount.value > mergedConfig.threshold!;
	}

	// Clear cache for an attribute
	function clearCache(attributeCode?: string) {
		if (attributeCode) {
			delete optionsCache[attributeCode];
			delete loadingStates[attributeCode];
		} else {
			// Clear all
			Object.keys(optionsCache).forEach(key => delete optionsCache[key]);
			Object.keys(loadingStates).forEach(key => delete loadingStates[key]);
		}
	}

	// Get option label
	function getOptionLabel(attributeCode: string, value: any): string {
		const cache = getCacheEntry(attributeCode);
		const option = cache.options.value.find(opt => opt.value === value);
		return option?.text || String(value);
	}

	return {
		loadOptions,
		getOptionsRef,
		getLoadingRef,
		getTotalCountRef,
		shouldUseSearch,
		clearCache,
		getOptionLabel,
		config: mergedConfig,
	};
}