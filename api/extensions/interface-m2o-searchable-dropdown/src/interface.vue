<template>
	<v-menu attached :disabled="disabled" :close-on-content-click="true">
		<template #activator="{ active, activate }">
			<v-input
				v-model="searchQuery"
				:disabled="disabled"
				:placeholder="placeholder"
				:class="{ 'has-value': sanitizedValue }"
				:nullable="false"
				@focus="activate"
				@update:model-value="onInput"
			>
				<template #prepend>
					<v-avatar :small="true" v-if="selectedItemImage">
						<v-image :src="getImageUrl(selectedItemImage)" :alt="searchQuery" />
					</v-avatar>
				</template>
				<template #append>
					<v-icon v-if="sanitizedValue !== null" clickable name="close" @click="setDropdown(null)" />
					<v-icon
						v-else
						clickable
						name="expand_more"
						class="open-indicator"
						:class="{ open: active }"
						@click="activate"
					/>
				</template>
			</v-input>
		</template>

		<div class="content" :class="width">
			<v-list class="list">
				<v-list-item :disabled="sanitizedValue === null" @click="setDropdown(null)">
					<v-list-item-content>Deselect</v-list-item-content>
					<v-list-item-icon>
						<v-icon name="close" />
					</v-list-item-icon>
				</v-list-item>
				<v-divider />

				<v-list-item
					v-for="(item, index) in results"
					:key="item[primaryKey.field] + index"
					:active="sanitizedValue === item[primaryKey.field]"
					:disabled="disabled"
					@click="setDropdown(item)"
				>
					<v-avatar :small="true" class="image-avatar">
						<v-image v-if="item.image" :src="getImageUrl(item.image)" :alt="outputFields(item)" />
						<v-icon v-else name="image" />
					</v-avatar>
					<v-list-item-content>
						<span class="item-text">{{ outputFields(item) }}</span>
					</v-list-item-content>
				</v-list-item>
			</v-list>
		</div>
	</v-menu>
</template>

<script lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useApi, useStores } from '@directus/extensions-sdk';
export default {
	props: {
		disabled: {
			type: Boolean,
			default: false,
		},
		collection: {
			type: String,
			required: true,
		},
		field: {
			type: String,
			required: true,
		},
		value: {
			default: null,
			validator: (value: any) => {
				// Accept null, string, number, boolean, object or undefined
				return (
					value === null ||
					typeof value === 'string' ||
					typeof value === 'number' ||
					typeof value === 'boolean' ||
					typeof value === 'object' ||
					value === undefined
				);
			},
		},
		placeholder: {
			type: String,
			default: 'Select an item',
		},
		template: {
			type: String,
			default: 'label',
		},
		width: {
			type: String,
			required: true,
		},
		filter: {
			type: Object,
			default: null,
		},
	},
	emits: ['input'],
	setup(props, { emit }) {
		const api = useApi();
		const { useCollectionsStore, useRelationsStore, useFieldsStore } = useStores();
		const collectionsStore = useCollectionsStore();
		const relationsStore = useRelationsStore();
		const fieldsStore = useFieldsStore();

		// Define useRelation function first
		function useRelation() {
			const relation = computed(() => {
				return relationsStore.getRelationsForField(props.collection, props.field)?.[0];
			});

			const relatedCollection = computed(() => {
				if (!relation.value?.related_collection) return null;
				return collectionsStore.getCollection(relation.value.related_collection);
			});

			return { relatedCollection };
		}

		// Internal state to maintain the actual selected value
		const internalValue = ref(null);

		// Store the last valid object value
		const lastValidObjectValue = ref(null as Record<string, any> | null);

		// Store selected item image
		const selectedItemImage = ref(null as string | null);

		// Get primary key field - define this before using it in the watcher
		const { relatedCollection } = useRelation();
		const targetCollection = computed(() => {
			// If we have a relation, use it; otherwise use the collection prop directly
			return relatedCollection.value?.collection || props.collection;
		});

		const primaryKey = computed(() => {
			return fieldsStore.getPrimaryKeyFieldForCollection(targetCollection.value);
		});

		watch(
			() => props.value,
			(newVal) => {
				console.log('m2o watcher - received value:', newVal, 'type:', typeof newVal);
				
				// COMPLETELY IGNORE boolean values - they are dropdown states, not actual values
				if (typeof newVal === 'boolean') {
					console.log('m2o interface - ignoring boolean dropdown state:', newVal, 'keeping internalValue:', internalValue.value);
					return; // Exit early to prevent any further processing
				}
				
				// Handle object values (when loading existing data from the interface)
				if (newVal && typeof newVal === 'object' && !Array.isArray(newVal)) {
					// Store this as our last valid object for display purposes
					lastValidObjectValue.value = newVal;
					// Store image if available
					selectedItemImage.value = newVal && 'image' in newVal ? newVal.image : null;
					// Extract code from object - this is what gets saved to product_attributes
					if (newVal.code !== undefined) {
						internalValue.value = newVal.code; // Store the code, not the ID
					}
				}
				// Handle direct code values (what's actually stored in product_attributes)
				else if (typeof newVal === 'string') {
					internalValue.value = newVal; // This is the code reference
					// Clear last object since we now have just a code
					lastValidObjectValue.value = null;
				} else if (newVal === null) {
					internalValue.value = null;
					lastValidObjectValue.value = null;
				}
			},
			{ immediate: true },
		);

		// Use internal value instead of prop value, but ignore boolean props.value
		const sanitizedValue = computed(() => {
			console.log('m2o sanitizedValue - props.value:', props.value, 'internalValue:', internalValue.value);
			// If props.value is boolean, completely ignore it and use internalValue
			if (typeof props.value === 'boolean') {
				console.log('m2o sanitizedValue - ignoring boolean props.value, using internalValue:', internalValue.value);
				return internalValue.value;
			}
			return internalValue.value;
		});

		const displayField = props.template.replace('{{', '').replace('}}', '');

		let awaitingSearch = false;
		const results = ref([] as any[]);
		const searchQuery = ref('');

		async function fetchResults() {
			console.log('fetchResults', searchQuery.value);
			try {
				const collection = targetCollection.value;
				if (!collection) {
					console.warn('No target collection available');
					return;
				}

				const response = await api.get(`/items/${collection}`, {
					params: {
						limit: -1,
						filter: props.filter,
						search: searchQuery.value || '',
					},
				});

				results.value = response.data.data;
			} catch (err) {
				console.warn(err);
			}
		}

		async function loadDisplayValue() {
			const sanitizedVal = sanitizedValue.value;
			const collection = targetCollection.value;

			// If we have an object value, use it directly
			if (props.value && typeof props.value === 'object' && !Array.isArray(props.value)) {
				searchQuery.value = outputFields(props.value);
				selectedItemImage.value = props.value && 'image' in props.value ? props.value.image : null;
				console.log('loaded display value from object:', searchQuery.value);
				return;
			}

			// Otherwise fetch the display value by code
			if (sanitizedVal != null && collection && searchQuery.value === '') {
				try {
					// Search by code instead of ID
					const response = await api.get(`/items/${collection}`, {
						params: {
							filter: { code: { _eq: sanitizedVal } },
							limit: 1,
						},
					});

					if (response.data.data.length > 0) {
						const fetchedItem = response.data.data[0];
						searchQuery.value = outputFields(fetchedItem);
						selectedItemImage.value = fetchedItem && 'image' in fetchedItem ? fetchedItem.image : null;
						console.log('loaded display value:', searchQuery.value);
					}
				} catch (error) {
					console.warn('Failed to fetch item for display:', error);
					searchQuery.value = '';
					selectedItemImage.value = null;
				}
			}
		}

		// Initialize: load display value and fetch initial results
		onMounted(async () => {
			await loadDisplayValue();
			await fetchResults();
		});

		// Watch for changes to sanitizedValue
		watch(sanitizedValue, async (newVal) => {
			if (newVal) {
				await loadDisplayValue();
			}
		});

		// Get image URL helper
		function getImageUrl(imageId: string | null): string {
			if (!imageId) return '';
			// Construct the URL for Directus assets
			return `/assets/${imageId}?width=40&height=40&fit=cover`;
		}

		return {
			results,
			setDropdown,
			searchQuery,
			displayField,
			onInput,
			primaryKey,
			outputFields,
			sanitizedValue,
			selectedItemImage,
			getImageUrl,
		};

		function outputFields(item: any) {
			if (!item) return '';

			let displayTemplate = props.template;

			// Handle special Directus template variables
			if (displayTemplate.includes('{{$thumbnail}}')) {
				// For now, replace $thumbnail with a fallback
				displayTemplate = displayTemplate.replace(
					'{{$thumbnail}}',
					item.label || item.name || item.title || item.code || item.id,
				);
			}

			// Replace regular field variables
			Object.keys(item).forEach((key) => {
				const placeholder = '{{' + key + '}}';
				if (displayTemplate.includes(placeholder)) {
					const value = item[key];
					displayTemplate = displayTemplate.replace(new RegExp('\\{\\{' + key + '\\}\\}', 'g'), value || '');
				}
			});

			return displayTemplate;
		}

		function onInput() {
			if (!awaitingSearch) {
				setTimeout(() => {
					fetchResults();
					awaitingSearch = false;
				}, 500); // 0.5 sec delay
			}

			awaitingSearch = true;
		}

		// Safe emit function that never emits boolean values
		function safeEmit(eventName: string, value: any) {
			if (typeof value === 'boolean') {
				console.warn('m2o interface - prevented emitting boolean value:', value);
				return;
			}
			console.log('m2o interface - emitting:', eventName, value);
			emit(eventName, value);
		}

		function setDropdown(item: any) {
			console.log('setDropdown called with:', item);
			if (item == null) {
				searchQuery.value = '';
				internalValue.value = null;
				selectedItemImage.value = null;
				console.log('setDropdown - emitting null');
				safeEmit('input', null);
			} else {
				searchQuery.value = outputFields(item);
				selectedItemImage.value = item && 'image' in item ? item.image : null;
				if (item.code !== undefined) {
					internalValue.value = item.code; // Store the code
					console.log('setDropdown - emitting code:', item.code);
					// Emit the code instead of the full object
					safeEmit('input', item.code);
				} else {
					console.warn('setDropdown - item has no code property:', item);
				}
			}

			fetchResults();
		}
	},
};
</script>

<style lang="scss" scoped>
.item-text {
	line-height: 32px;
}

.image-avatar {
	margin-right: 8px;
}
</style>
