<template>
  <div class="test-layout">
    <h2>Product Grid Test Layout</h2>
    <div class="debug-info">
      <p>Collection: {{ collection }}</p>
      <p>Items: {{ items?.length || 0 }}</p>
      <p>Loading: {{ loading }}</p>
      <p>Page: {{ page }}/{{ totalPages }}</p>
      <p>Item Count: {{ itemCount }}</p>
    </div>
    
    <div v-if="items && items.length > 0">
      <h3>First Item:</h3>
      <pre>{{ JSON.stringify(items[0], null, 2) }}</pre>
    </div>
    
    <div v-else>
      <p>No items received</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';

const props = defineProps({
  collection: String,
  items: Array,
  loading: Boolean,
  error: Object,
  totalPages: Number,
  itemCount: Number,
  page: Number,
  limit: Number,
});

onMounted(() => {
  console.log('[Test Layout] All props:', props);
  console.log('[Test Layout] Items:', props.items);
});
</script>

<style scoped>
.test-layout {
  padding: 20px;
}

.debug-info {
  background: #f5f5f5;
  padding: 10px;
  margin: 10px 0;
  border-radius: 4px;
}

pre {
  background: #f0f0f0;
  padding: 10px;
  overflow: auto;
}
</style>