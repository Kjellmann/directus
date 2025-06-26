import { defineLayout } from '@directus/extensions-sdk';
import { useCollection } from '@directus/extensions-sdk';
import { computed, ref, toRefs, watch, inject, Ref } from 'vue';
import TabularEnhanced from './tabular-enhanced-v2.vue';
import ProductGridOptions from './options.vue';
import ProductGridActions from './actions.vue';
import { useProductClickHandler } from './composables/use-product-click-handler';

export default defineLayout({
	id: 'product-grid',
	name: 'Product Grid',
	icon: 'grid_view',
	component: TabularEnhanced,
	slots: {
		options: ProductGridOptions,
		sidebar: () => null,
		actions: ProductGridActions,
	},
	setup(props, { emit }) {
		const { collection, search } = toRefs(props);
		const api = inject('api') as any;

		// Get collection info
		const { primaryKeyField, fields: fieldsInCollection, info, sortField } = useCollection(collection as any);

		// Helper function to clean filter objects
		function cleanFilter(filter: any): any {
			if (!filter || typeof filter !== 'object') return filter;
			
			// Handle _and/_or arrays
			if (filter._and && Array.isArray(filter._and)) {
				const cleaned = filter._and
					.map(f => cleanFilter(f))
					.filter(f => f !== null && Object.keys(f).length > 0);
				
				if (cleaned.length === 0) return null;
				if (cleaned.length === 1) return cleaned[0];
				return { _and: cleaned };
			}
			
			if (filter._or && Array.isArray(filter._or)) {
				const cleaned = filter._or
					.map(f => cleanFilter(f))
					.filter(f => f !== null && Object.keys(f).length > 0);
				
				if (cleaned.length === 0) return null;
				if (cleaned.length === 1) return cleaned[0];
				return { _or: cleaned };
			}
			
			// Clean individual filter objects
			const cleaned = {};
			for (const [key, value] of Object.entries(filter)) {
				if (value === null || value === undefined) continue;
				
				// Check if it's an operator object
				if (typeof value === 'object' && !Array.isArray(value)) {
					// Check for empty operator values like {_eq: null}
					const operators = ['_eq', '_neq', '_in', '_nin', '_gt', '_gte', '_lt', '_lte', '_contains', '_icontains'];
					let hasValidValue = false;
					
					for (const op of operators) {
						if (value[op] !== undefined) {
							if (value[op] === null || value[op] === '' || (Array.isArray(value[op]) && value[op].length === 0)) {
								// Skip empty values
								continue;
							}
							hasValidValue = true;
						}
					}
					
					// Check for _empty/_nempty which are valid without values
					if (value._empty === true || value._nempty === true) {
						hasValidValue = true;
					}
					
					if (hasValidValue) {
						cleaned[key] = value;
					}
				} else {
					// Non-object values (direct values)
					cleaned[key] = value;
				}
			}
			
			return Object.keys(cleaned).length > 0 ? cleaned : null;
		}

		// State
		const items = ref([]);
		const loading = ref(false);
		const error = ref(null);
		const totalPages = ref(1);
		const itemCount = ref(0);
		const totalCount = ref(0);
		const attributes = ref([]);
		
		// Local filter state (props.filter is readonly)
		// Initialize from layoutQuery if available, otherwise from props
		// Clean up any invalid filter states (like {id: {_eq: null}})
		const initialFilter = props.layoutQuery?.filter || props.filter || null;
		const localFilter = ref(cleanFilter(initialFilter));

		// Layout state management
		const selection = computed({
			get: () => props.selection || [],
			set: (val) => emit('update:selection', val),
		});

		const layoutOptions = computed({
			get: () => {
				const options = props.layoutOptions || {};
				return {
					spacing: options.spacing || 'cozy',
					viewMode: options.viewMode || 'list',
					...options,
				};
			},
			set: (val) => emit('update:layoutOptions', val),
		});

		const layoutQuery = computed({
			get: () => props.layoutQuery || {},
			set: (val) => emit('update:layoutQuery', val),
		});

		// Query parameters
		const page = computed({
			get: () => layoutQuery.value.page || 1,
			set: (val) => {
				layoutQuery.value = { ...layoutQuery.value, page: val };
			},
		});

		const limit = computed({
			get: () => layoutQuery.value.limit || 25,
			set: (val) => {
				layoutQuery.value = { ...layoutQuery.value, limit: val };
			},
		});

		const sort = computed({
			get: () => layoutQuery.value.sort || [],
			set: (val) => {
				layoutQuery.value = { ...layoutQuery.value, sort: val };
			},
		});

		// Load attributes from the attributes collection
		async function loadAttributes() {
			try {
				const response = await api.get('/items/attributes', {
					params: {
						fields: [
							'id',
							'code',
							'label',
							'usable_in_grid',
							'usable_in_filter',
							'usable_in_search',
							'type',
							'type.input_interface',
						],
						filter: {
							usable_in_grid: { _eq: true },
						},
						limit: -1,
					},
				});

				// Transform attributes to include type_info
				const attributes = response.data?.data || [];
				return attributes.map((attr) => ({
					...attr,
					type_info: attr.type, // type is expanded with input_interface
				}));
			} catch (error) {
				console.error('[Product Grid] Error loading attributes:', error);
				return [];
			}
		}

		// Load items using our custom API
		async function loadItems() {
			if (collection.value !== 'products') {
				console.warn('[Product Grid] This layout only works with products collection');
				return;
			}

			loading.value = true;
			error.value = null;

			try {
				const params = {
					page: page.value,
					limit: limit.value,
					sort: sort.value?.[0] || '-date_created',
					search: search.value || '',
					filter: localFilter.value ? JSON.stringify(localFilter.value) : undefined,
					attribute_filters: layoutQuery.value.attribute_filters || undefined,
				};

				console.log('[Product Grid] loadItems called with localFilter.value:', localFilter.value);
				console.log('[Product Grid] loadItems params:', params);

				const response = await api.get('/product-grid/products', { params });

				items.value = response.data.data || [];
				totalCount.value = response.data.meta?.total_count || 0;
				itemCount.value = totalCount.value;
				totalPages.value = Math.ceil(totalCount.value / limit.value);
			} catch (err) {
				console.error('[Product Grid] Error loading items:', err);
				error.value = err;
				items.value = [];
			} finally {
				loading.value = false;
			}
		}

		// Table configuration
		const tableHeaders = ref([]);
		const tableSort = computed(() => {
			if (!sort.value?.[0]) {
				return null;
			} else if (sort.value[0].startsWith('-')) {
				return { by: sort.value[0].substring(1), desc: true };
			} else {
				return { by: sort.value[0], desc: false };
			}
		});

		// Layout configuration
		const spacing = computed({
			get: () => layoutOptions.value.spacing || 'cozy',
			set: (val) => {
				layoutOptions.value = { ...layoutOptions.value, spacing: val };
			},
		});

		const viewMode = computed({
			get: () => layoutOptions.value.viewMode || 'list',
			set: (val) => {
				layoutOptions.value = { ...layoutOptions.value, viewMode: val };
			},
		});

		const tableRowHeight = computed(() => {
			switch (spacing.value) {
				case 'compact':
					return 32;
				case 'cozy':
				default:
					return 80;
				case 'comfortable':
					return 64;
			}
		});

		// Initialize and refresh
		function refresh() {
			loadItems();
		}

		// Watch for changes
		watch([page, limit, sort, localFilter, search, () => layoutQuery.value.attribute_filters], () => {
			loadItems();
		});
		
		// Watch for external filter changes from props
		watch(() => props.filter, (newFilter) => {
			const cleanedFilter = cleanFilter(newFilter);
			if (cleanedFilter !== localFilter.value) {
				localFilter.value = cleanedFilter;
			}
		});

		// Initial load
		loadItems();

		// Load attributes on startup
		loadAttributes().then((attrs) => {
			attributes.value = attrs;
		});

		// Methods
		function toPage(newPage: number) {
			page.value = newPage;
		}

		function onSortChange(newSort: { by: string; desc: boolean }) {
			if (!newSort?.by) {
				sort.value = [];
				return;
			}

			let sortString = newSort.by;
			if (newSort.desc === true) {
				sortString = '-' + sortString;
			}

			sort.value = [sortString];
		}

		function onFilterChange(filters: { filter: any; attribute_filters: string | null }) {
			console.log('[Product Grid] onFilterChange called with:', filters);
			console.log('[Product Grid] Filter before update:', localFilter.value);

			// Clean and update the local filter reactive variable which is being watched
			const cleanedFilter = cleanFilter(filters.filter);
			localFilter.value = cleanedFilter;
			
			console.log('[Product Grid] Filter after cleaning and update:', localFilter.value);

			// Update layoutQuery with both standard filters and attribute filters
			const updates: any = {};
			
			// Store standard filters
			if (cleanedFilter) {
				updates.filter = cleanedFilter;
			} else {
				// If no filters, we need to explicitly remove it
				updates.filter = undefined;
			}
			
			// Store attribute filters
			if (filters.attribute_filters) {
				updates.attribute_filters = filters.attribute_filters;
			} else {
				updates.attribute_filters = undefined;
			}

			// Update layoutQuery
			layoutQuery.value = {
				...layoutQuery.value,
				...updates
			};
			
			// Remove undefined values
			Object.keys(layoutQuery.value).forEach(key => {
				if (layoutQuery.value[key] === undefined) {
					delete layoutQuery.value[key];
				}
			});
			
			console.log('[Product Grid] Updated layoutQuery:', layoutQuery.value);
		}

		// Use the Directus-style click handler
		const { onClick: onRowClick } = useProductClickHandler(
			collection as Ref<string>,
			primaryKeyField,
			selection,
			props.selectMode || false,
			props.readonly || false,
		);

		function selectAll() {
			if (!primaryKeyField.value || !items.value) return;
			const pk = primaryKeyField.value.field;
			selection.value = items.value.map((item: any) => item[pk]);
		}

		return {
			// Data
			items,
			loading,
			error,
			totalPages,
			itemCount,
			totalCount,

			// Table config
			tableHeaders,
			tableSort,
			tableRowHeight,
			spacing,
			viewMode,

			// Collection info
			collection: collection.value,
			primaryKeyField,
			info,
			fields: fieldsInCollection,
			attributeList: attributes,

			// Methods
			refresh,
			toPage,
			onSortChange,
			onFilterChange,
			onRowClick,
			selectAll,

			// Pagination
			page,
			limit,

			// Selection
			selection,
			showSelect: props.selectMode ? 'multiple' : 'none',
			readonly: props.readonly || false,

			// Search/filter
			search,
			filter: localFilter,
			sortField,

			// Flag to indicate we're using the API
			useCustomApi: true,

			// Layout options for persistence
			layoutOptions,
			layoutQuery,
		};
	},
});
