<template>
    <div class="module">
      <button @click="confirmCharacter" :disabled="disabled">确认角色创建并导出JSON</button>
    </div>
  </template>
  
  <script lang="ts" setup>
  import { defineProps, defineEmits } from 'vue'
  
  defineProps<{
    disabled: boolean
  }>()
  
  const emit = defineEmits(['confirm-character'])
  
  function confirmCharacter() {
    emit('confirm-character')
  }
  </script>