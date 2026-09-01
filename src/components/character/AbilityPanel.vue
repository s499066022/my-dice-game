<template>
  <div class="ability-panel">
    <!-- 点购总览 -->
    <div class="pb-bar">
      <span>可花费点数：<strong>{{ POINT_BUY_MAX }}</strong></span>
      <span>总花费：<strong>{{ spent }}</strong></span>
      <span :class="{ 'pb-neg': remaining < 0 }">剩余：<strong>{{ remaining }}</strong></span>
      <el-button size="small" text @click="resetPointBuy">重置点购（全 8）</el-button>
      <span v-if="remaining < 0" class="pb-warn">⚠️ 已超出可花费点数</span>
    </div>

    <!-- 属性计算表 -->
    <div class="ap-table-wrap">
      <table class="ap-table">
        <thead>
          <tr>
            <th>属性</th>
            <th>基础</th>
            <th>花费</th>
            <th>背景</th>
            <th>属性提升</th>
            <th>专长</th>
            <th>物品</th>
            <th>替代</th>
            <th>最终</th>
            <th>调整</th>
            <th>豁免</th>
            <th>熟练豁免</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="k in ABILITY_KEYS" :key="k">
            <td class="ap-ability">{{ ABILITY_LABELS[k] }} <small>{{ ABILITY_ABBR[k] }}</small></td>
            <td><el-input-number v-model="card.abilities[k].base" :min="8" :max="15" size="small" controls-position="right" class="ap-num" /></td>
            <td class="ap-cost">{{ pointBuyCost(card.abilities[k].base) }}</td>
            <td><el-input-number v-model="card.abilities[k].background" :min="0" :max="10" size="small" class="ap-num" /></td>
            <td><el-input-number v-model="card.abilities[k].asi" :min="0" :max="10" size="small" class="ap-num" /></td>
            <td><el-input-number v-model="card.abilities[k].feat" :min="0" :max="10" size="small" class="ap-num" /></td>
            <td><el-input-number v-model="card.abilities[k].item" :min="0" :max="10" size="small" class="ap-num" /></td>
            <td class="ap-repl">
              <el-input-number v-model="card.abilities[k].replacement" :min="1" :max="40" size="small" class="ap-num" placeholder="—" />
              <el-button v-if="card.abilities[k].replacement != null" size="small" text @click="clearReplacement(k)">×</el-button>
            </td>
            <td class="ap-final">{{ getAbilityScore(card, k) }}</td>
            <td class="ap-mod">{{ fmtMod(getAbilityModifier(card, k)) }}</td>
            <td class="ap-save">{{ fmtMod(getSaveValue(card, k)) }}</td>
            <td class="ap-profic"><el-checkbox v-model="card.abilities[k].saveProficient" /></td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="ap-foot">
      被动察觉：<strong>{{ card.passivePerception }}</strong>
      <span class="ap-foot-hint">（可在「战斗/资源」页调整）</span>
    </div>

    <!-- 花费表参考 -->
    <div class="ap-cost-ref">
      <span class="ap-cost-ref-title">花费表：</span>
      <span v-for="(cost, val) in POINT_BUY_COST" :key="val" class="ap-cost-ref-item">{{ val }}→{{ cost }}</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import type { CharacterCard } from '../../data/dndModel'
import {
  ABILITY_KEYS,
  ABILITY_LABELS,
  ABILITY_ABBR,
  type AbilityKey,
  getAbilityScore,
  getAbilityModifier,
  getSaveValue,
  pointBuyCost,
  getPointBuySpent,
  getPointBuyRemaining,
  POINT_BUY_MAX,
  POINT_BUY_COST,
} from '../../data/dndModel'

const props = defineProps<{ card: CharacterCard }>()

const spent = computed(() => getPointBuySpent(props.card))
const remaining = computed(() => getPointBuyRemaining(props.card))

function fmtMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}

function resetPointBuy() {
  for (const k of ABILITY_KEYS) props.card.abilities[k].base = 8
}

function clearReplacement(k: AbilityKey) {
  props.card.abilities[k].replacement = null
}
</script>

<style scoped>
.ability-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.pb-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  color: #4b5563;
  padding: 8px 10px;
  background: #eef2ff;
  border-radius: 8px;
  flex-wrap: wrap;
}
.pb-neg {
  color: #dc2626;
}
.pb-warn {
  color: #dc2626;
  font-size: 12px;
}

.ap-table-wrap {
  overflow-x: auto;
}
.ap-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 760px;
}
.ap-table th,
.ap-table td {
  border: 1px solid #e5e7eb;
  padding: 4px 6px;
  font-size: 12px;
  text-align: center;
  white-space: nowrap;
}
.ap-table th {
  background: #f3f4f6;
}
.ap-ability {
  font-weight: 600;
  text-align: left;
  min-width: 84px;
}
.ap-ability small {
  color: #9ca3af;
  font-weight: 400;
  margin-left: 4px;
}
.ap-num :deep(.el-input-number) {
  width: 84px;
}
.ap-cost {
  color: #6b7280;
}
.ap-final {
  font-weight: 700;
  color: #111827;
}
.ap-mod {
  font-weight: 600;
}
.ap-save {
  font-weight: 600;
  color: #2563eb;
}
.ap-repl {
  display: flex;
  align-items: center;
  gap: 2px;
  justify-content: center;
}
.ap-repl :deep(.el-input-number) {
  width: 76px;
}

.ap-foot {
  font-size: 13px;
  color: #4b5563;
  padding-top: 8px;
  border-top: 1px dashed #e5e7eb;
}
.ap-foot-hint {
  color: #9ca3af;
  font-size: 12px;
}

.ap-cost-ref {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
}
.ap-cost-ref-title {
  font-weight: 600;
}
.ap-cost-ref-item {
  padding: 2px 6px;
  background: #f3f4f6;
  border-radius: 4px;
}
</style>
