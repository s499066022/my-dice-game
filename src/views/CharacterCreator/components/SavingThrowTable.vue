<template>
    <div class="module">
      <h3>豁免检定</h3>
      <table>
        <thead>
          <tr>
            <th>属性</th>
            <th>基础值</th>
            <th>调整值</th>
            <th>是否熟练</th>
            <th>豁免值</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in savingThrowData" :key="item.name">
            <td>{{ item.displayName }}</td>
            <td>{{ item.value }}</td>
            <td>{{ item.modifier >= 0 ? '+' + item.modifier : item.modifier }}</td>
            <td><input type="checkbox" disabled :checked="item.isProficient" /></td>
            <td>{{ item.saveValue >= 0 ? '+' + item.saveValue : item.saveValue }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </template>
  
  <script lang="ts" setup>
  defineProps<{
    savingThrowData: Array<{
      name: string
      displayName: string
      value: number
      modifier: number
      isProficient: boolean
      saveValue: number
    }>
  }>()
  
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