import { AttributeDefinition } from './useAttributeValues';

/**
 * Represents a column in a table attribute
 */
export interface TableColumn {
	code: string;
	label: string;
	type: string;
	required?: boolean;
	width?: string | number;
	placeholder?: string;
	defaultValue?: any;
	options?: Record<string, any>;
}

/**
 * Composable for managing table attributes
 */
export function useTableAttributes() {
	/**
	 * Check if an attribute is a table attribute
	 */
	function isTableAttribute(attribute: AttributeDefinition): boolean {
		return attribute.type.input_interface === 'table';
	}

	/**
	 * Get table columns from attribute metadata
	 */
	function getTableColumns(attribute: AttributeDefinition): TableColumn[] {
		return attribute.meta_options?.columns || [];
	}

	/**
	 * Create a new empty row with default values
	 */
	function createEmptyRow(columns: TableColumn[]): Record<string, any> {
		return columns.reduce(
			(acc, column) => {
				acc[column.code] = column.defaultValue ?? null;
				return acc;
			},
			{} as Record<string, any>,
		);
	}

	return {
		isTableAttribute,
		getTableColumns,
		createEmptyRow,
	};
}
