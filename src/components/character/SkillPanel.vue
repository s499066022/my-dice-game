<template>
  <div class="skill-panel">
    <div v-for="k in ABILITY_KEYS" :key="k" class="sp-group">
      <div class="sp-group-title">{{ ABILITY_LABELS[k] }}（{{ ABILITY_ABBR[k] }}）</div>
      <div class="sp-row sp-head">
        <span class="sp-col sp-name">技能</span>
        <span class="sp-col sp-prof">熟练</span>
        <span class="sp-col sp-mod">属性调整</span>
        <span class="sp-col sp-total">总值</span>
      </div>
      <div v-for="s in skillsOf(k)" :key="s.name" class="sp-row">
        <span class="sp-col sp-name">{{ s.name }}</span>
        <span class="sp-col sp-prof">
          <el-select v-model="card.skills[s.name].proficient" size="small" style="width: 108px">
            <el-option :value="0" label="未熟练" />
            <el-option :value="1" label="熟练" />
            <el-option :value="2" label="专家" />
          </el-select>
        </span>
        <span class="sp-col sp-mod">{{ fmtMod(getAbilityModifier(card, k)) }}</span>
        <span class="sp-col sp-total">{{ fmtMod(getSkillTotal(card, s.name)) }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { CharacterCard } from '../../data/dndModel'
import {
  ABILITY_KEYS,
  ABILITY_LABELS,
  ABILITY_ABBR,
  SKILLS,
  type AbilityKey,
  getAbilityModifier,
  getSkillTotal,
} from '../../data/dndModel'

defineProps<{ card: CharacterCard }>()

function skillsOf(k: AbilityKey) {
  return SKILLS.filter((s) => s.ability === k)
}

function fmtMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}
</script>

<style scoped>
.skill-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.sp-group-title {
  font-weight: 700;
  font-size: 14px;
  margin-bottom: 4px;
  color: #374151;
}
.sp-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
}
.sp-head {
  font-size: 12px;
  color: #9ca3af;
}
.sp-name {
  width: 90px;
  flex: 0 0 auto;
}
.sp-prof {
  width: 116px;
}
.sp-mod {
  width: 88px;
  text-align: center;
  color: #6b7280;
}
.sp-total {
  width: 60px;
  text-align: center;
  font-weight: 600;
}
</style>
