// composables/useAttributeValues.ts
import { ref, Ref } from 'vue';
import { useApi } from '@directus/extensions-sdk';
import { type AttributeGroup } from './useAttributeGroups';

export interface AttributeDefinition {
	id: string | number;
	code: string;
	label: string;
	type: {
		id: number;
		name: string;
		code: string;
		description: string | null;
		input_interface: string;
	};
	group?: {
		id: number;
		label: string;
		code: string;
		sort: number;
		enabled: boolean;
		attributes: (string | number)[];
	};
	sort?: number;
	user_created?: string;
	date_created?: string;
	user_updated?: string | null;
	date_updated?: string | null;
	read_only: boolean;
	required?: boolean | null;
	description?: string | null;
	validation_regex?: string | null;
	validation_message?: string | null;
	min_length?: number | null;
	max_length?: number | null;
	min_value?: number | null;
	max_value?: number | null;
	is_localizable?: boolean | null;
	is_scopeable?: boolean | null;
	used_in_variants?: boolean | null;
	is_filterable?: boolean | null;
	is_searchable?: boolean | null;
	is_comparable?: boolean | null;
	position_in_filter?: number | null;
	use_for_promo_rule_conditions?: boolean | null;
	unique_value?: boolean | null;
	default_value?: any;
	decimals_allowed?: boolean | null;
	negative_allowed?: boolean | null;
	options?: Array<{
		id: number;
		sort: number | null;
		attribute_id: number;
		label: string;
		code: string;
	}>;
	metric_family?: {
		id: string | number;
	} | null;
	meta_options?: Record<string, any>;
	reference_collection?: string | null;
}

export interface AttributeValueItem {
	id: string | number | null;
	product_id: string | number;
	attribute_id: AttributeDefinition;
	value: any;
}

export function useAttributeValues() {
	const api = useApi();

	/**
	 * Parse a value loaded from the database
	 */
	function parseLoadedValue(dbValue: any, attributeType?: string): any {
		if (dbValue === null || dbValue === undefined) {
			return null;
		}

		// For reference entities
		if (attributeType === 'reference_entity_single') {
			// The stored value should be a JSON-stringified code
			if (typeof dbValue === 'string') {
				try {
					// Try to parse it in case it's JSON stringified
					return JSON.parse(dbValue);
				} catch (e) {
					// If parsing fails, return as-is (it might already be the code)
					return dbValue;
				}
			}
			return dbValue;
		}
		
		if (attributeType === 'reference_entity_multiple') {
			// For multiple references, parse the array of codes
			if (typeof dbValue === 'string') {
				try {
					return JSON.parse(dbValue);
				} catch (e) {
					return [];
				}
			}
			return Array.isArray(dbValue) ? dbValue : [];
		}

		// For simple scalar types, return as-is
		if (attributeType === 'text' || attributeType === 'text_area' || attributeType === 'identifier') {
			return dbValue;
		}

		if (attributeType === 'number' || attributeType === 'price') {
			return typeof dbValue === 'number' ? dbValue : parseFloat(dbValue) || null;
		}

		if (attributeType === 'yes_no') {
			return typeof dbValue === 'boolean' ? dbValue : Boolean(dbValue);
		}

		// For complex types, try to parse as JSON
		if (typeof dbValue === 'string') {
			try {
				const parsed = JSON.parse(dbValue);

				if (Array.isArray(parsed)) {
					return parsed.map((row) => {
						if (typeof row === 'object' && row !== null) {
							return Object.fromEntries(
								Object.entries(row).map(([key, val]) => {
									return [key, parseLoadedValue(val, attributeType)];
								}),
							);
						}
						return row;
					});
				}

				return parsed;
			} catch (e) {
				return dbValue;
			}
		}

		return dbValue;
	}

	/**
	 * Prepare a value for saving to the database
	 */
	function prepareValueForSave(value: any, attributeType?: string): any {
		if (value === null || value === undefined) return null;

		// For arrays (e.g. table attribute), filter empty rows before saving
		if (Array.isArray(value) && value[0]?.type === 'table') {
			const nonEmptyRows = value.filter((row) => {
				if (typeof row !== 'object' || row === null) return true;

				// Check if all values in the row are null/empty
				const allEmpty = Object.values(row).every(
					(cellValue) => cellValue === null || cellValue === undefined || cellValue === '',
				);

				return !allEmpty;
			});

			if (nonEmptyRows.length === 0) return null;

			try {
				return JSON.stringify(nonEmptyRows);
			} catch (e) {
				console.error('[AttributeValues] Error stringifying array value:', e);
				return null;
			}
		}

		// For reference entities
		if (attributeType === 'reference_entity_single') {
			console.log('[AttributeValues] prepareValueForSave - reference_entity_single:', value, 'type:', typeof value);
			// For single reference, we want to store only the code (not the full object)
			if (value !== null && value !== undefined) {
				// If value is already a string (the code), return it directly
				if (typeof value === 'string') {
					console.log('[AttributeValues] Saving string code:', value);
					return JSON.stringify(value);
				}
				// If value is an object with a code property, extract and save the code
				else if (typeof value === 'object' && value.code) {
					console.log('[AttributeValues] Extracting code from object:', value.code);
					return JSON.stringify(value.code);
				}
				// If value is an object with an id property but no code, save the id
				else if (typeof value === 'object' && value.id) {
					console.warn('[AttributeValues] Reference entity has id but no code, saving id:', value.id);
					return JSON.stringify(value.id);
				}
				console.warn('[AttributeValues] Unexpected value format for reference_entity_single:', value);
			}
			console.log('[AttributeValues] Returning null for reference_entity_single');
			return null;
		}
		
		if (attributeType === 'reference_entity_multiple') {
			// For multiple references, store the array of codes
			if (Array.isArray(value)) {
				const codes = value.map(item => {
					if (typeof item === 'string') return item;
					if (typeof item === 'object' && item.code) return item.code;
					if (typeof item === 'object' && item.id) return item.id;
					return null;
				}).filter(Boolean);
				
				return codes.length > 0 ? JSON.stringify(codes) : null;
			}
			return null;
		}

		// For simple scalar values, JSON stringify them for the JSON column
		if (attributeType === 'number' || attributeType === 'price') {
			let numValue = null;
			
			// Handle both number and string inputs
			if (typeof value === 'number') {
				numValue = value;
			} else if (typeof value === 'string' && value.trim() !== '') {
				const parsed = parseFloat(value);
				if (!isNaN(parsed)) {
					numValue = parsed;
				}
			}
			
			return numValue !== null ? JSON.stringify(numValue) : null;
		}

		if (attributeType === 'text' || attributeType === 'text_area' || attributeType === 'identifier') {
			const stringValue = typeof value === 'string' ? value : null;
			return stringValue !== null ? JSON.stringify(stringValue) : null;
		}

		if (attributeType === 'yes_no') {
			const boolValue = typeof value === 'boolean' ? value : null;
			return boolValue !== null ? JSON.stringify(boolValue) : null;
		}

		// For any other type of value, stringify for storage
		if (
			typeof value === 'object' ||
			typeof value === 'string' ||
			typeof value === 'number' ||
			typeof value === 'boolean'
		) {
			try {
				return JSON.stringify(value);
			} catch (e) {
				console.error('[AttributeValues] Error stringifying value:', e);
				return null;
			}
		}

		return null;
	}

	/**
	 * Fetch attribute values by their IDs
	 */
	async function fetchAttributeValuesByIds(
		collection: string,
		recordIds: (string | number)[],
		attributeDefinitions: AttributeDefinition[],
	): Promise<AttributeValueItem[]> {
		if (!recordIds || recordIds.length === 0) return [];

		try {
			const response = await api.get(`/items/${collection}`, {
				params: {
					filter: { id: { _in: recordIds } },
					fields: ['id', 'product_id', 'attribute_id', 'value', 'sort'],
				},
			});

			const fetchedItems = response.data.data as any[];
			const attributeMap = attributeDefinitions.reduce(
				(map, attr) => {
					map[attr.id] = attr;
					return map;
				},
				{} as Record<string | number, AttributeDefinition>,
			);

			return fetchedItems
				.map((item) => {
					const attributeDef = attributeMap[item.attribute_id];
					if (!attributeDef) {
						console.warn(`[AttributeValues] Couldn't find definition for attribute_id: ${item.attribute_id}`);
						return null;
					}

					return {
						id: item.id,
						product_id: item.product_id,
						attribute_id: attributeDef,
						value: parseLoadedValue(item.value, attributeDef.type?.input_interface),
					};
				})
				.filter(Boolean) as AttributeValueItem[];
		} catch (error) {
			console.error(`[AttributeValues] Error fetching ${collection} values:`, error);
			return [];
		}
	}

	/**
	 * Generate a save payload for attributes
	 */
	function prepareSavePayload(relationData: AttributeValueItem[]): any[] {
		return relationData
			.map((item): any | null => {
				if (!item.attribute_id?.id) return null;

				const attributeType = item.attribute_id.type?.input_interface;
				const preparedValue = prepareValueForSave(item.value, attributeType);

				if (preparedValue === undefined) {
					console.log(
						`[AttributeValues] Skipping ${item.attribute_id.code} in save payload due to undefined prepared value.`,
					);
					return null;
				}

				const baseItem = {
					attribute_id: item.attribute_id.id,
					value: preparedValue,
				};

				if (item.id) {
					return {
						id: item.id,
						...baseItem,
					};
				} else if (preparedValue !== null) {
					return baseItem;
				}

				return null;
			})
			.filter(Boolean);
	}

	/**
	 * Initialize attribute value with default from the attribute definition
	 */
	function initializeDefaultValue(attribute: AttributeDefinition): any {
		if (attribute.default_value !== undefined && attribute.default_value !== null) {
			return attribute.default_value;
		}

		if (attribute.type.input_interface === 'table') {
			return [];
		}

		if (attribute.type.input_interface === 'yes_no') {
			return false;
		}

		return null;
	}

	return {
		parseLoadedValue,
		prepareValueForSave,
		fetchAttributeValuesByIds,
		prepareSavePayload,
		initializeDefaultValue,
	};
}
