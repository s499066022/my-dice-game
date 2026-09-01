<template>
  <div class="resource-list">
    <div v-if="!items.length" class="rl-empty">还没有资源，点击下方添加（如狂暴次数、斗气、充能、法术位等）。</div>
    <table v-else class="rl-table">
      <thead>
        <tr>
          <th>名称</th>
          <th>剩余</th>
          <th>上限</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in items" :key="r.id">
          <td>
            <el-input v-model="r.name" size="small" placeholder="资源名称" />
          </td>
          <td class="rl-num">
            <el-input-number v-model="r.available" :min="0" :max="99999" size="small" controls-position="right" />
          </td>
          <td class="rl-num">
            <el-input-number v-model="r.total" :min="0" :max="99999" size="small" controls-position="right" @change="clamp(r)" />
          </td>
          <td>
            <el-button size="small" type="danger" text @click="remove(r)">删除</el-button>
          </td>
        </tr>
      </tbody>
    </table>
    <el-button size="small" @click="add">＋ 添加资源</el-button>
  </div>
</template>

<script lang="ts" setup>
import type { CardResource } from '../../data/dndModel'
import { uid } from '../../data/dndModel'

const props = defineProps<{ items: CardResource[] }>()

function add() {
  props.items.push({ id: uid(), name: '', available: 0, total: 0 })
}

function remove(r: CardResource) {
  const idx = props.items.findIndex((x) => x.id === r.id)
  if (idx !== -1) props.items.splice(idx, 1)
}

function clamp(r: CardResource) {
  if (r.total < 0) r.total = 0
  if (r.available > r.total) r.available = r.total
  if (r.available < 0) r.available = 0
}
</script>

<style scoped>
.resource-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rl-empty {
  color: #9ca3af;
  font-size: 13px;
  padding: 8px 0;
}
.rl-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 4px;
}
.rl-table th,
.rl-table td {
  border: 1px solid #e5e7eb;
  padding: 4px 8px;
  text-align: left;
  font-size: 13px;
}
.rl-table th {
  background: #f3f4f6;
}
.rl-num {
  width: 140px;
}
.rl-num :deep(.el-input-number) {
  width: 120px;
}
</style>
