// composables/useMetricAttributes.ts
import { ref, Ref } from 'vue';
import { useApi } from '@directus/extensions-sdk';

interface AttributeValueItem {
	id: string | number | null;
	product_id: string | number;
	attribute_id: any;
	value: any;
}

export function useMetricAttributes() {
	const api = useApi();

	// Cache for metric units
	const metricUnitsCache = ref<Record<string | number, any[]>>({});

	/**
	 * Extract the value for display in the component
	 */
	function getMetricDisplayValue(item: AttributeValueItem): any {
		if (
			item.attribute_id.type.input_interface === 'measurement' &&
			typeof item.value === 'object' &&
			item.value !== null
		) {
			return item.value.value;
		}
		return item.value;
	}

	/**
	 * Get the default (standard) unit for a metric family
	 */
	async function getDefaultUnitForFamily(familyId: string | number): Promise<{ id: string | number; symbol: string } | null> {
		if (!familyId) return null;

		try {
			// Check cache first
			const units = metricUnitsCache.value[familyId] || [];
			const cachedStandardUnit = units.find((unit) => unit.standard === true);

			if (cachedStandardUnit) {
				return {
					id: cachedStandardUnit.value,
					symbol: cachedStandardUnit.symbol
				};
			}

			// If not in cache, fetch from API
			const response = await api.get('/items/metric_units', {
				params: {
					filter: {
						family: { _eq: familyId },
						standard_unit: { _eq: true },
					},
					limit: 1,
					fields: ['id', 'code', 'symbol', 'standard_unit'],
				},
			});

			if (response.data && response.data.data && response.data.data.length > 0) {
				const unit = response.data.data[0];
				return {
					id: unit.id,
					symbol: unit.symbol || ''
				};
			}

			// If no standard unit, get any unit as fallback
			const fallbackResponse = await api.get('/items/metric_units', {
				params: {
					filter: { family: { _eq: familyId } },
					limit: 1,
					fields: ['id', 'symbol'],
				},
			});

			if (fallbackResponse.data && fallbackResponse.data.data && fallbackResponse.data.data.length > 0) {
				const unit = fallbackResponse.data.data[0];
				return {
					id: unit.id,
					symbol: unit.symbol || ''
				};
			}
		} catch (error) {
			console.error('[MetricAttributes] Error fetching default unit:', error);
		}

		return null;
	}

	/**
	 * Fetch available units for a metric family
	 */
	async function getMetricUnits(attribute: any): Promise<any[]> {
		if (!attribute.metric_family?.id) return [];

		// Check cache first
		if (metricUnitsCache.value[attribute.metric_family.id]) {
			return metricUnitsCache.value[attribute.metric_family.id];
		}

		try {
			// Fetch units for this metric family
			const response = await api.get('/items/metric_units', {
				params: {
					filter: { family: { _eq: attribute.metric_family.id } },
					fields: ['id', 'code', 'label', 'symbol', 'standard_unit'],
				},
			});

			if (response.data && response.data.data) {
				const units = response.data.data.map((unit: any) => ({
					text: unit.symbol, // Show only symbol in dropdown
					value: unit.id,
					label: unit.label,
					symbol: unit.symbol,
					standard: unit.standard_unit || false,
				}));

				// Cache the result
				metricUnitsCache.value[attribute.metric_family.id] = units;
				return units;
			}
		} catch (error) {
			console.error('[MetricAttributes] Error fetching metric units:', error);
		}

		return [];
	}

	/**
	 * Get the selected unit ID (async version)
	 */
	async function getSelectedMetricUnit(item: AttributeValueItem): Promise<string | number | null> {
		// If a unit is already selected in the value, use that
		if (item.value && typeof item.value === 'object' && item.value.unit) {
			return item.value.unit.id;
		}

		// Otherwise, get the standard unit for the family
		if (item.attribute_id.metric_family?.id) {
			const defaultUnit = await getDefaultUnitForFamily(item.attribute_id.metric_family.id);
			return defaultUnit ? defaultUnit.id : null;
		}

		return null;
	}

	/**
	 * Get the selected unit ID (sync version)
	 */
	function getSelectedMetricUnitSync(item: AttributeValueItem): string | number | null {
		// If a unit is already selected in the value, use that
		if (item.value && typeof item.value === 'object' && item.value.unit) {
			return item.value.unit.id;
		}

		// Otherwise return null - the async version will be called separately
		return null;
	}

	/**
	 * Create or update a metric value
	 */
	async function updateMetricValue(
		item: AttributeValueItem,
		newValue: any,
		relationData: Ref<AttributeValueItem[]>,
	): Promise<AttributeValueItem[]> {
		// Find the item in relationData
		const index = relationData.value.findIndex((rd) => rd.attribute_id.id === item.attribute_id.id);

		if (index !== -1) {
			// Get current unit or default unit
			let currentUnit;

			// Try to get unit from current value
			const currentValue = relationData.value[index].value || {};
			if (currentValue && typeof currentValue === 'object' && currentValue.unit && currentValue.unit.id) {
				currentUnit = currentValue.unit;
			} else {
				// Try to get default unit
				const defaultUnit = await getDefaultUnitForFamily(item.attribute_id.metric_family?.id || '');

				if (defaultUnit) {
					currentUnit = {
						id: defaultUnit.id,
						symbol: defaultUnit.symbol
					};
				}
			}

			// If we still don't have a unit, use a placeholder
			if (!currentUnit) {
				currentUnit = {
					id: null,
					symbol: '',
				};
			}

			// Update with a new metric value object
			relationData.value[index] = {
				...relationData.value[index],
				value: {
					value: newValue,
					unit: currentUnit,
				},
			};
		}

		return [...relationData.value]; // Return a new array to trigger reactivity
	}

	/**
	 * Update the unit for a metric value
	 */
	function updateMetricUnit(
		item: AttributeValueItem,
		unitId: string | number,
		relationData: Ref<AttributeValueItem[]>,
	): AttributeValueItem[] {
		const metricUnits = metricUnitsCache.value[item.attribute_id.metric_family?.id ?? ''] || [];
		const selectedUnit = metricUnits.find((u) => u.value === unitId);
		const index = relationData.value.findIndex((rd) => rd.attribute_id.id === item.attribute_id.id);

		if (index !== -1) {
			// Get current value (or default to empty string)
			const currentValue =
				typeof relationData.value[index].value === 'object'
					? relationData.value[index].value?.value || ''
					: relationData.value[index].value || '';

			// Update with new unit
			relationData.value[index] = {
				...relationData.value[index],
				value: {
					value: currentValue,
					unit: {
						id: unitId,
						symbol: selectedUnit?.symbol || '',
					},
				},
			};
		}

		return [...relationData.value];
	}

	return {
		metricUnitsCache,
		getMetricDisplayValue,
		getMetricUnits,
		getSelectedMetricUnit,
		getSelectedMetricUnitSync,
		getDefaultUnitForFamily,
		updateMetricValue,
		updateMetricUnit,
	};
}
