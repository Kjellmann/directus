<template>
  <div class="product-grid-layout">
    <div class="layout-header">
      <h2>Products Grid</h2>
    </div>
    <div class="layout-content">
      <div v-if="loading" class="loading-state">
        <p>Loading...</p>
      </div>
      <div v-else>
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id">
              <td>{{ item.id }}</td>
              <td>{{ item.date_created }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useApi } from '@directus/extensions-sdk';

const api = useApi();
const loading = ref(true);
const items = ref<any[]>([]);

const loadData = async () => {
  try {
    const response = await api.get('/items/products', {
      params: { limit: 10 }
    });
    items.value = response.data.data || [];
  } catch (error) {
    console.error('Error loading products:', error);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.product-grid-layout {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.layout-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-normal);
}

.layout-content {
  flex: 1;
  overflow: auto;
  padding: 16px;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 8px;
  text-align: left;
  border-bottom: 1px solid var(--border-subdued);
}
</style>