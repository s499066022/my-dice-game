<template>
  <div class="feature-list">
    <div v-if="!items.length" class="fl-empty">{{ emptyText }}</div>
    <div v-else class="fl-rows">
      <div v-for="f in items" :key="f.id" class="fl-row">
        <div class="fl-lv">
          <span class="fl-lv-label">级</span>
          <el-input-number v-model="f.level" :min="0" :max="99" size="small" controls-position="right" />
        </div>
        <div class="fl-main">
          <div class="fl-top">
            <el-input v-model="f.name" size="small" placeholder="名称" />
            <el-button size="small" type="danger" text @click="remove(f)">删除</el-button>
          </div>
          <el-input v-model="f.description" type="textarea" :rows="2" size="small" placeholder="描述" />
        </div>
      </div>
    </div>
    <el-button size="small" @click="add">＋ 添加{{ addText }}</el-button>
  </div>
</template>

<script lang="ts" setup>
import type { FeatureEntry } from '../../data/dndModel'
import { uid } from '../../data/dndModel'

const props = defineProps<{
  items: FeatureEntry[]
  emptyText?: string
  addText?: string
}>()

function add() {
  props.items.push({ id: uid(), level: 0, name: '', description: '' })
}

function remove(f: FeatureEntry) {
  const idx = props.items.findIndex((x) => x.id === f.id)
  if (idx !== -1) props.items.splice(idx, 1)
}
</script>

<style scoped>
.feature-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fl-empty {
  color: #9ca3af;
  font-size: 13px;
  padding: 8px 0;
}
.fl-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fl-row {
  display: flex;
  gap: 8px;
  padding: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}
.fl-lv {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  flex: 0 0 auto;
}
.fl-lv :deep(.el-input-number) {
  width: 70px;
}
.fl-lv-label {
  font-size: 11px;
  color: #9ca3af;
}
.fl-main {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.fl-top {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
}
.fl-top :deep(.el-input) {
  flex: 1;
}
</style>
