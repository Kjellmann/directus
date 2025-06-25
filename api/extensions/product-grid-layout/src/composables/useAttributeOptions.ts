import { ref, Ref } from 'vue';
import { useApi } from '@directus/extensions-sdk';

// Shared cache for attribute options
const optionsCache: Record<string, Ref<any[]>> = {};
const loadingPromiseCache: Record<string, Promise<any[]>> = {};

export function useAttributeOptions() {
	const api = useApi();

	// Function to get reactive options for an attribute
	function getOptionsRef(attributeCode: string) {
		if (!optionsCache[attributeCode]) {
			optionsCache[attributeCode] = ref([]);
		}
		return optionsCache[attributeCode];
	}

	async function loadOptions(attributeCode: string) {
		// Return cached options if already loaded and has data
		if (optionsCache[attributeCode] && optionsCache[attributeCode].value.length > 0) {
			return optionsCache[attributeCode].value;
		}

		// Return existing promise if already loading
		if (attributeCode in loadingPromiseCache) {
			return loadingPromiseCache[attributeCode];
		}

		// Initialize cache entry
		if (!optionsCache[attributeCode]) {
			optionsCache[attributeCode] = ref([]);
		}

		// Create loading promise
		loadingPromiseCache[attributeCode] = (async () => {
			try {
				const response = await api.get('/product-grid/products/filters', {
					params: { attribute_code: attributeCode },
				});

				if (response.data && response.data.data) {
					// Store options in cache
					optionsCache[attributeCode].value = response.data.data;
				}

				return optionsCache[attributeCode].value;
			} catch (error) {
				console.error(`Failed to load options for ${attributeCode}:`, error);
				// Remove failed promise from cache so it can be retried
				delete loadingPromiseCache[attributeCode];
				return [];
			}
		})();

		return loadingPromiseCache[attributeCode];
	}

	function getOptionLabel(attributeCode: string, value: any): string {
		const options = optionsCache[attributeCode]?.value || [];

		// Find option with matching value
		const option = options.find((opt: any) => opt.value === value);
		if (option) {
			return option.text || option.label || value;
		}

		// Fallback to the value itself
		return String(value);
	}

	return {
		loadOptions,
		getOptionLabel,
		getOptionsRef,
		optionsCache,
	};
}
