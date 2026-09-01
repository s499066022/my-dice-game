<template>
  <div class="skills-section">
    <!-- 调试信息 -->
    <pre>availableSkills: {{ availableSkills }}</pre>
    <pre>selectedSkills: {{ selectedSkills }}</pre>
    <pre>maxSkillSelection: {{ maxSkillSelection }}</pre>

    <h3>技能选择（最多选 {{ maxSkillSelection }} 项）</h3>

    <div v-if="loading" class="loading">正在加载职业数据...</div>
    <div v-else-if="availableSkills.length === 0" class="no-skills">
      暂无可用技能，请先选择一个职业。
    </div>
    <div v-else class="skill-list">
      <div
        v-for="skill in availableSkills"
        :key="skill"
        class="skill-item"
      >
        <input
          type="checkbox"
          :id="skill"
          :checked="selectedSkills.includes(skill)"
          @change="
            $emit('toggle-skill', skill);
            console.log('子组件 emit 触发:', skill)
          "
          :disabled="!selectedSkills.includes(skill) && selectedSkills.length >= maxSkillSelection"
        />
        <label :for="skill">{{ skill }}</label>
      </div>
    </div>

    <!-- 手动测试按钮（开发时用） -->
    <!-- <button @click="$emit('toggle-skill', '运动')">手动触发 toggle-skill</button> -->
  </div>
</template>

<script setup lang="ts">
defineProps<{
  availableSkills: string[];
  selectedSkills: string[];
  maxSkillSelection: number;
  loading?: boolean; // 可选属性
  skillTableData?: any[]; // 可选属性，用于未来扩展
}>()

const emit = defineEmits<{
  (e: 'toggle-skill', skill: string): void;
}>()
</script>

<style scoped>
.skills-section {
  margin-top: 1rem;
  padding: 1rem;
  border: 1px solid #ccc;
  border-radius: 8px;
  background-color: #f9f9f9;
}

.skill-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.skill-item {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  min-width: 120px;
}

.loading,
.no-skills {
  color: #666;
  font-style: italic;
}
</style>