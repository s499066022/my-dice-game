<template>
    <div class="module">
      <h3>角色信息录入</h3>
      <label>角色名称：</label>
      <input v-model="character.name" placeholder="请输入角色名" /><br />
  
      <label>职业名称：</label>
      <select v-model="character.class">
        <option value="Barbarian">野蛮人</option>
        <option value="Fighter">战士</option>
      </select><br />
  
      <label>职业等级：</label>
      <input type="number" min="1" max="20" v-model.number="character.level" /><br />
  
      <p><strong>熟练加值：</strong> +{{ proficiencyBonus }}</p>
    </div>
  </template>
  
  <script lang="ts" setup>
  import { defineProps, defineEmits } from 'vue'
  
  const props = defineProps<{
    character: {
      name: string
      class: string
      level: number
    }
    proficiencyBonus: number
  }>()
  
  const emit = defineEmits(['update:character'])
  
  const character = props.character
  </script>