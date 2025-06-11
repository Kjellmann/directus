// composables/useAttributeState.ts
import { ref, computed } from 'vue';
import { AttributeValueItem, AttributeDefinition } from './useAttributeValues';

export interface AttributeStateItem extends AttributeValueItem {
  isDirty?: boolean;
  originalValue?: any;
  validationError?: string;
}

export function useAttributeState() {
  const stateMap = ref<Map<string | number, AttributeStateItem>>(new Map());
  const batchMode = ref(false);
  const batchChanges = ref<Map<string | number, any>>(new Map());

  /**
   * Initialize state from relation data
   */
  function initializeState(relationData: AttributeValueItem[]): void {
    stateMap.value.clear();
    relationData.forEach(item => {
      stateMap.value.set(item.attribute_id.id, {
        ...item,
        isDirty: false,
        originalValue: JSON.parse(JSON.stringify(item.value)),
      });
    });
  }

  /**
   * Get state for a specific attribute
   */
  function getAttributeState(attributeId: string | number): AttributeStateItem | undefined {
    return stateMap.value.get(attributeId);
  }

  /**
   * Update attribute value and track dirty state
   */
  function updateAttributeValue(attributeId: string | number, value: any): void {
    const state = stateMap.value.get(attributeId);
    if (!state) return;

    const isDirty = JSON.stringify(value) !== JSON.stringify(state.originalValue);
    
    stateMap.value.set(attributeId, {
      ...state,
      value,
      isDirty,
    });

    if (batchMode.value) {
      batchChanges.value.set(attributeId, value);
    }
  }

  /**
   * Validate attribute value
   */
  function validateAttribute(attribute: AttributeDefinition, value: any): string | null {
    // Required validation
    if (attribute.required && (value === null || value === undefined || value === '')) {
      return `${attribute.label} is required`;
    }

    // String length validation
    if (typeof value === 'string') {
      if (attribute.min_length && value.length < attribute.min_length) {
        return `${attribute.label} must be at least ${attribute.min_length} characters`;
      }
      if (attribute.max_length && value.length > attribute.max_length) {
        return `${attribute.label} must be no more than ${attribute.max_length} characters`;
      }
    }

    // Number range validation
    if (typeof value === 'number') {
      if (attribute.min_value !== null && attribute.min_value !== undefined && value < attribute.min_value) {
        return `${attribute.label} must be at least ${attribute.min_value}`;
      }
      if (attribute.max_value !== null && attribute.max_value !== undefined && value > attribute.max_value) {
        return `${attribute.label} must be no more than ${attribute.max_value}`;
      }
    }

    // Regex validation
    if (attribute.validation_regex && value) {
      try {
        const regex = new RegExp(attribute.validation_regex);
        if (!regex.test(String(value))) {
          return attribute.validation_message || `${attribute.label} format is invalid`;
        }
      } catch (e) {
        console.error('Invalid regex pattern:', attribute.validation_regex);
      }
    }

    return null;
  }

  /**
   * Get all dirty attributes
   */
  const dirtyAttributes = computed(() => {
    const dirty: AttributeStateItem[] = [];
    stateMap.value.forEach(state => {
      if (state.isDirty) {
        dirty.push(state);
      }
    });
    return dirty;
  });

  /**
   * Check if any attribute is dirty
   */
  const hasChanges = computed(() => dirtyAttributes.value.length > 0);

  /**
   * Reset specific attribute to original value
   */
  function resetAttribute(attributeId: string | number): void {
    const state = stateMap.value.get(attributeId);
    if (!state) return;

    stateMap.value.set(attributeId, {
      ...state,
      value: JSON.parse(JSON.stringify(state.originalValue)),
      isDirty: false,
      validationError: undefined,
    });
  }

  /**
   * Reset all attributes to original values
   */
  function resetAll(): void {
    stateMap.value.forEach((state, attributeId) => {
      resetAttribute(attributeId);
    });
    batchChanges.value.clear();
  }

  /**
   * Mark all current values as saved
   */
  function markAsSaved(): void {
    stateMap.value.forEach((state, attributeId) => {
      stateMap.value.set(attributeId, {
        ...state,
        originalValue: JSON.parse(JSON.stringify(state.value)),
        isDirty: false,
      });
    });
    batchChanges.value.clear();
  }

  /**
   * Enable/disable batch mode for list view updates
   */
  function setBatchMode(enabled: boolean): void {
    batchMode.value = enabled;
    if (!enabled) {
      batchChanges.value.clear();
    }
  }

  /**
   * Get all batch changes
   */
  function getBatchChanges(): Map<string | number, any> {
    return new Map(batchChanges.value);
  }

  return {
    stateMap: computed(() => stateMap.value),
    dirtyAttributes,
    hasChanges,
    batchMode: computed(() => batchMode.value),
    initializeState,
    getAttributeState,
    updateAttributeValue,
    validateAttribute,
    resetAttribute,
    resetAll,
    markAsSaved,
    setBatchMode,
    getBatchChanges,
  };
}