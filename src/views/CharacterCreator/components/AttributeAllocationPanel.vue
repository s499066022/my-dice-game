<template>
    <div class="module">
      <h3>属性点分配</h3>
      <p>剩余点数：{{ remainingPoints }}</p>
      <div v-if="showError" style="color: red;">点数超出，请检查输入</div>
  
      <div v-for="(value, key) in attributes" :key="key">
        {{ translateAbility(key) }}:
        <input
          type="number"
          v-model.number="attributes[key]"
          min="8"
          max="15"
          @change="$emit('calculate-points')"
        />
      </div>
    </div>
  </template>
  
  <script lang="ts" setup>
  import { defineProps, defineEmits } from 'vue'
  
  defineProps<{
    attributes: Record<string, number>
    remainingPoints: number
    showError: boolean
  }>()
  
  defineEmits(['calculate-points'])
  
  function translateAbility(key: string): string {
    const map: Record<string, string> = {
      strength: '力量',
      dexterity: '敏捷',
      constitution: '体质',
      intelligence: '智力',
      wisdom: '感知',
      charisma: '魅力'
    }
    return map[key] || key
  }
  </script>