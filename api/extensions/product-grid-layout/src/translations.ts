/**
 * Translation messages for the Product Grid Layout extension
 *
 * Since Directus doesn't currently support bundling translation files with extensions,
 * we define our translations in a central file that can be imported by components.
 *
 * @see https://github.com/directus/directus/discussions/19229
 */

export const translations = {
	en: {
		// Extension-specific translations only
		// Most common strings are already in Directus core

		// Column management (specific to our product grid)
		select_columns: 'Select Columns',
		manage_columns: 'Manage Columns',
		standard_fields: 'Standard Fields',
		view_mode: 'View Mode',
		list: 'List',
		grid: 'Grid',

		// Missing from Directus core
		filters: 'Filters',
		attributes: 'Attributes',
		apply: 'Apply',
		out_of: 'out of',
		visible: 'visible',
		
		// Filter specific
		active_filters: 'Active Filters',
		filters_active: '$t:filters ($t:count)',
		created_date: 'Created Date',
		date_created: 'Date Created',
		date_updated: 'Date Updated',
		enabled: 'Enabled',
		show_enabled_only: 'Show Enabled Only',
		id: 'ID',
		enter_id: 'Enter ID',
		parent_product_id: 'Parent Product ID',
		enter_parent_id: 'Enter Parent ID',
		product_type: 'Product Type',
		select_product_type: 'Select Product Type',
		family: 'Family',
		select_family: 'Select Family',
		family_variant: 'Family Variant',
		select_family_variant: 'Select Family Variant',
		select_operator: 'Select Operator',
		apply_filters: 'Apply Filters',
		clear_filters: 'Clear Filters',
		
		// Attribute selector
		select_attributes: 'Select Attributes',
		available_attributes: 'Available Attributes',
		toggle_all: 'Toggle All',
		no_attributes_selected: 'No Attributes Selected',
		select_attributes_from_sidebar: 'Select attributes from the sidebar to add filters',
		from: 'From',
		to: 'To',
		use_advanced_operators: 'Use Advanced Operators',
		select_values: 'Select Values',
		select_value: 'Select Value',
		min_value: 'Min',
		max_value: 'Max',
		enter_value: 'Enter Value',
		show_advanced: 'Show Advanced',
		hide_advanced: 'Hide Advanced',
		or_use_operator: 'Or use operator',
		
		// Operators
		equals: 'Equals',
		not_equals: 'Not Equals',
		contains: 'Contains',
		not_contains: 'Does Not Contain',
		starts_with: 'Starts With',
		ends_with: 'Ends With',
		is_empty: 'Is Empty',
		is_not_empty: 'Is Not Empty',
		greater_than: 'Greater Than',
		greater_or_equal: 'Greater or Equal',
		less_than: 'Less Than',
		less_or_equal: 'Less or Equal',
		between: 'Between',
		not_between: 'Not Between',
		in: 'In',
		not_in: 'Not In',
		before: 'Before',
		after: 'After',
		in_last: 'In Last',
		in_next: 'In Next',
		any: 'Any',
		yes: 'Yes',
		no: 'No',

		// Grid layout specific
		items_per_row: 'Items per Row',
		show_product_info: 'Show Product Info',
		
		// View presets
		view: 'View',
		views: 'Views',
		manage_views: 'Manage Views',
		save_view: 'Save View',
		save_current_view: 'Save Current View',
		update_view: 'Update View',
		delete_view: 'Delete View',
		view_name: 'View Name',
		enter_view_name: 'Enter view name',
		optional_description: 'Optional description',
		view_saved: 'View saved successfully',
		view_updated: 'View updated successfully',
		view_deleted: 'View deleted successfully',
		confirm_delete_view: 'Are you sure you want to delete this view?',
		set_as_default: 'Set as Default',
		default_view_set: 'Default view set successfully',
		no_saved_views: 'No saved views',
		modified: 'Modified',
	},
	no: {
		// Norwegian translations

		// Column management (specific to our product grid)
		select_columns: 'Velg kolonner',
		manage_columns: 'Administrer kolonner',
		standard_fields: 'Standardfelt',
		view_mode: 'Visning',
		list: 'Liste',
		grid: 'Rutenett',

		// Missing from Directus core
		filters: 'Filtre',
		attributes: 'Attributter',
		apply: 'Bruk',
		out_of: 'av',
		visible: 'synlige',
		
		// Filter specific
		active_filters: 'Aktive filtre',
		created_date: 'Opprettelsesdato',
		date_created: 'Opprettet dato',
		date_updated: 'Oppdatert dato',
		enabled: 'Aktivert',
		show_enabled_only: 'Vis kun aktiverte',
		id: 'ID',
		enter_id: 'Skriv inn ID',
		parent_product_id: 'Overordnet produkt-ID',
		enter_parent_id: 'Skriv inn overordnet ID',
		product_type: 'Produkttype',
		select_product_type: 'Velg produkttype',
		family: 'Familie',
		select_family: 'Velg familie',
		family_variant: 'Familievariant',
		select_family_variant: 'Velg familievariant',
		select_operator: 'Velg operator',
		apply_filters: 'Bruk filtre',
		clear_filters: 'Fjern filtre',
		from: 'Fra',
		to: 'Til',
		use_advanced_operators: 'Bruk avanserte operatorer',
		select_values: 'Velg verdier',
		select_value: 'Velg verdi',
		min_value: 'Min',
		max_value: 'Maks',
		enter_value: 'Skriv inn verdi',
		show_advanced: 'Vis avansert',
		hide_advanced: 'Skjul avansert',
		or_use_operator: 'Eller bruk operator',
		
		// Operators
		equals: 'Er lik',
		not_equals: 'Er ikke lik',
		contains: 'Inneholder',
		not_contains: 'Inneholder ikke',
		starts_with: 'Starter med',
		ends_with: 'Slutter med',
		is_empty: 'Er tom',
		is_not_empty: 'Er ikke tom',
		greater_than: 'Større enn',
		greater_or_equal: 'Større eller lik',
		less_than: 'Mindre enn',
		less_or_equal: 'Mindre eller lik',
		between: 'Mellom',
		not_between: 'Ikke mellom',
		in: 'I',
		not_in: 'Ikke i',
		before: 'Før',
		after: 'Etter',
		in_last: 'I siste',
		in_next: 'I neste',
		any: 'Alle',
		yes: 'Ja',
		no: 'Nei',

		// Grid layout specific
		items_per_row: 'Elementer per rad',
		show_product_info: 'Vis produktinformasjon',
		
		// View presets
		view: 'Visning',
		views: 'Visninger',
		manage_views: 'Administrer visninger',
		save_view: 'Lagre visning',
		save_current_view: 'Lagre gjeldende visning',
		update_view: 'Oppdater visning',
		delete_view: 'Slett visning',
		view_name: 'Visningsnavn',
		enter_view_name: 'Skriv inn visningsnavn',
		optional_description: 'Valgfri beskrivelse',
		view_saved: 'Visning lagret',
		view_updated: 'Visning oppdatert',
		view_deleted: 'Visning slettet',
		confirm_delete_view: 'Er du sikker på at du vil slette denne visningen?',
		set_as_default: 'Sett som standard',
		default_view_set: 'Standardvisning satt',
		no_saved_views: 'Ingen lagrede visninger',
		modified: 'Endret',
	},
};

/**
 * Resolve locale to a simplified format
 * Converts 'en-US' to 'en', 'fr-FR' to 'fr', etc.
 */
export function resolveLocale(locale: string): string {
	if (locale) {
		if (locale.includes('-')) {
			return locale.split('-')[0].toLowerCase();
		}
		return locale.toLowerCase();
	}
	return 'en';
}

/**
 * Helper to create i18n options with our translations
 * @param locale - The current locale from Directus settings
 */
export function createI18nOptions(locale?: string) {
	return {
		locale: locale ? resolveLocale(locale) : 'en',
		messages: translations,
	};
}
