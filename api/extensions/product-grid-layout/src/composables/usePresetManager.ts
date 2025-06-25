import { ref, computed, Ref } from 'vue';

export interface ProductGridPreset {
	id: string;
	name: string;
	description?: string;
	isDefault?: boolean;
	createdAt: string;
	updatedAt: string;
	view: {
		// Column configuration only
		columns: {
			selected: string[];
			widths: Record<string, number>;
			alignments: Record<string, string>;
		};
	};
}

interface PresetManagerOptions {
	collection: string;
	layoutOptions: Ref<any>;
	layoutQuery: Ref<any>;
	tableHeaders: Ref<any[]>;
	currentFilters: Ref<any>;
	currentAttributeFilters: Ref<any>;
	emit: (event: string, value: any) => void;
}

const STORAGE_KEY = 'product_grid_presets';

// Default view columns: Image, SKU, Name, Enabled, Price
const DEFAULT_VIEW_COLUMNS = ['primary_image', 'attr_sku', 'attr_name', 'enabled', 'attr_price'];

export function usePresetManager(options: PresetManagerOptions) {
	const { collection, layoutOptions, layoutQuery, tableHeaders, currentFilters, currentAttributeFilters, emit } = options;
	
	const presets = ref<ProductGridPreset[]>([]);
	const activePresetId = ref<string | null>(null);
	const isDirty = ref(false);
	
	// Load presets from localStorage
	const loadPresets = () => {
		try {
			const key = `${STORAGE_KEY}_${collection}`;
			console.log('[PresetManager] Loading presets with key:', key);
			const stored = localStorage.getItem(key);
			if (stored) {
				const parsed = JSON.parse(stored);
				presets.value = parsed.presets || [];
				activePresetId.value = parsed.activePresetId || null;
				console.log('[PresetManager] Loaded presets:', presets.value);
			} else {
				console.log('[PresetManager] No stored presets found');
			}
		} catch (error) {
			console.error('[PresetManager] Failed to load presets:', error);
		}
	};
	
	// Save presets to localStorage
	const saveToLocalStorage = () => {
		try {
			const key = `${STORAGE_KEY}_${collection}`;
			const data = {
				presets: presets.value,
				activePresetId: activePresetId.value,
			};
			console.log('[PresetManager] Saving to localStorage with key:', key);
			console.log('[PresetManager] Data to save:', data);
			localStorage.setItem(key, JSON.stringify(data));
		} catch (error) {
			console.error('[PresetManager] Failed to save presets:', error);
		}
	};
	
	// Get current view state (columns only)
	const getCurrentViewState = () => {
		return {
			columns: {
				selected: layoutOptions.value?.savedColumns || tableHeaders.value?.map((h: any) => h.value) || [],
				widths: layoutOptions.value?.columnWidths || {},
				alignments: layoutOptions.value?.columnAlignments || {},
			},
		};
	};
	
	// Check if current state matches a preset
	const checkDirtyState = () => {
		if (!activePresetId.value) {
			isDirty.value = false;
			return;
		}
		
		const activePreset = presets.value.find(p => p.id === activePresetId.value);
		if (!activePreset) {
			isDirty.value = false;
			return;
		}
		
		const currentState = getCurrentViewState();
		isDirty.value = JSON.stringify(currentState) !== JSON.stringify(activePreset.view);
	};
	
	// Save current view as preset
	const savePreset = (name: string, description?: string): ProductGridPreset => {
		console.log('[PresetManager] Saving preset:', name);
		const viewState = getCurrentViewState();
		console.log('[PresetManager] Current view state:', viewState);
		
		const now = new Date().toISOString();
		const preset: ProductGridPreset = {
			id: `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
			name,
			description,
			createdAt: now,
			updatedAt: now,
			view: viewState,
		};
		
		presets.value.push(preset);
		activePresetId.value = preset.id;
		isDirty.value = false;
		saveToLocalStorage();
		
		console.log('[PresetManager] Preset saved:', preset);
		console.log('[PresetManager] All presets:', presets.value);
		
		return preset;
	};
	
	// Update existing preset
	const updatePreset = (presetId: string): boolean => {
		const preset = presets.value.find(p => p.id === presetId);
		if (!preset) return false;
		
		preset.view = getCurrentViewState();
		preset.updatedAt = new Date().toISOString();
		
		isDirty.value = false;
		saveToLocalStorage();
		
		return true;
	};
	
	// Apply preset (columns only)
	const applyPreset = (presetId: string) => {
		const preset = presets.value.find(p => p.id === presetId);
		if (!preset) return;
		
		console.log('[PresetManager] Applying preset:', preset.name);
		console.log('[PresetManager] Preset columns:', preset.view.columns.selected);
		
		// Update layout options (columns only)
		emit('update:layoutOptions', {
			...layoutOptions.value,
			savedColumns: preset.view.columns.selected,
			columnWidths: preset.view.columns.widths,
			columnAlignments: preset.view.columns.alignments,
		});
		
		activePresetId.value = presetId;
		isDirty.value = false;
		
		// Also save to localStorage to persist the active preset
		saveToLocalStorage();
	};
	
	// Delete preset
	const deletePreset = (presetId: string): boolean => {
		const index = presets.value.findIndex(p => p.id === presetId);
		if (index === -1) return false;
		
		presets.value.splice(index, 1);
		
		if (activePresetId.value === presetId) {
			activePresetId.value = null;
		}
		
		saveToLocalStorage();
		return true;
	};
	
	// Set default preset
	const setDefaultPreset = (presetId: string | null) => {
		// Clear all defaults
		presets.value.forEach(p => p.isDefault = false);
		
		if (presetId) {
			const preset = presets.value.find(p => p.id === presetId);
			if (preset) {
				preset.isDefault = true;
			}
		}
		
		saveToLocalStorage();
	};
	
	
	// Get active preset
	const activePreset = computed(() => {
		return presets.value.find(p => p.id === activePresetId.value);
	});
	
	// Get default preset
	const defaultPreset = computed(() => {
		return presets.value.find(p => p.isDefault);
	});
	
	// Create default view if none exists
	const createDefaultView = () => {
		const now = new Date().toISOString();
		const defaultView: ProductGridPreset = {
			id: 'default-view',
			name: 'Default View',
			description: 'Standard product view with essential columns',
			isDefault: true,
			createdAt: now,
			updatedAt: now,
			view: {
				columns: {
					selected: DEFAULT_VIEW_COLUMNS,
					widths: {
						primary_image: 80,
						attr_sku: 150,
						attr_name: 250,
						enabled: 100,
						attr_price: 120,
					},
					alignments: {},
				},
			},
		};
		
		presets.value.push(defaultView);
		saveToLocalStorage();
		return defaultView;
	};
	
	// Initialize
	loadPresets();
	
	// Create default view if no presets exist
	if (presets.value.length === 0) {
		const defaultView = createDefaultView();
		// Apply default view after a small delay to ensure everything is loaded
		setTimeout(() => {
			applyPreset(defaultView.id);
		}, 200);
	} else if (!activePresetId.value && defaultPreset.value) {
		// Apply default preset on load if no active preset
		setTimeout(() => {
			applyPreset(defaultPreset.value!.id);
		}, 200);
	}
	
	return {
		presets: computed(() => presets.value),
		activePreset,
		activePresetId: computed(() => activePresetId.value),
		isDirty: computed(() => isDirty.value),
		
		loadPresets,
		savePreset,
		updatePreset,
		applyPreset,
		deletePreset,
		setDefaultPreset,
		checkDirtyState,
	};
}