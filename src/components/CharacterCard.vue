<template>
  <div class="module">
    <h3>角色信息录入</h3>

    <label for="characterName">角色名称：</label>
    <input
      type="text"
      id="characterName"
      v-model="character.name"
      placeholder="请输入角色名"
    /><br />

    <label for="characterClass">职业名称：</label>
    <select id="characterClass" v-model="character.class">
      <option value="Barbarian">野蛮人</option>
      <option value="Fighter">战士</option></select
    ><br />

    <label for="classLevel">职业等级：</label>
    <input
      type="number"
      id="classLevel"
      min="1"
      max="20"
      v-model.number="character.level"
    /><br />

    <p><strong>熟练加值：</strong> +{{ currentProficiencyBonus }}</p>

    <button @click="updateCharacterInfo">更新角色信息</button>
  </div>

 

  <!-- 属性点分配 -->
  <div class="module">
    <h3>属性点分配</h3>
    <p>总点数：27</p>
    <p>
      剩余点数：<span>{{ remainingPoints }}</span>
    </p>
    <p class="error" v-if="showError">分配超出限制，请调整属性值。</p>

    <label for="strength">力量：</label>
    <input
      type="number"
      id="strength"
      min="8"
      max="15"
      v-model.number="attributes.strength"
      @change="calculatePoints"
    /><br />

    <label for="dexterity">敏捷：</label>
    <input
      type="number"
      id="dexterity"
      min="8"
      max="15"
      v-model.number="attributes.dexterity"
      @change="calculatePoints"
    /><br />

    <label for="constitution">体质：</label>
    <input
      type="number"
      id="constitution"
      min="8"
      max="15"
      v-model.number="attributes.constitution"
      @change="calculatePoints"
    /><br />

    <label for="intelligence">智力：</label>
    <input
      type="number"
      id="intelligence"
      min="8"
      max="15"
      v-model.number="attributes.intelligence"
      @change="calculatePoints"
    /><br />

    <label for="wisdom">感知：</label>
    <input
      type="number"
      id="wisdom"
      min="8"
      max="15"
      v-model.number="attributes.wisdom"
      @change="calculatePoints"
    /><br />

    <label for="charisma">魅力：</label>
    <input
      type="number"
      id="charisma"
      min="8"
      max="15"
      v-model.number="attributes.charisma"
      @change="calculatePoints"
    /><br />

    <table>
      <tr>
        <th>属性值</th>
        <th>对应花费</th>
      </tr>
      <tr v-for="(cost, value) in attributeCostMap" :key="value">
        <td>{{ value }}</td>
        <td>{{ cost }}</td>
      </tr>
    </table>
  </div>
</template>

<script lang="ts" setup>
import { ref, reactive, computed, watch } from "vue";

// 当前角色信息
const character = reactive({
  name: "",
  class: "Fighter", // 默认战士
  level: 1,
});

// 属性点相关逻辑保持不变...

// 职业数据存储
const classData = ref<any>(null);
const loading = ref(false);

// 加载职业数据
const loadClassData = async (className: string) => {
  loading.value = true;
  const response = await fetch(`/characterData/all_class/${className}.json`);
  classData.value = await response.json();
  loading.value = false;
};

// 初始化加载默认职业数据
loadClassData(character.class);

// 监听职业变化时重新加载数据
watch(
  () => character.class,
  (newClass) => {
    loadClassData(newClass);
  }
);

// 计算当前等级的熟练加值
const currentProficiencyBonus = computed(() => {
  if (!classData.value || !classData.value.features) return 0;
  const feature = classData.value.features.find(
    (f: any) => f.level === character.level
  );
  return feature ? parseInt(feature.proficiencyBonus.replace("+", ""), 10) : 0;
});
const attributes = reactive({
  strength: 8,
  dexterity: 8,
  constitution: 8,
  intelligence: 8,
  wisdom: 8,
  charisma: 8,
});

const previousValues = reactive({ ...attributes });
const showError = ref(false);

// 属性花费表
const attributeCostMap = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

// 计算剩余点数
const totalSpent = computed(() => {
  return Object.values(attributes).reduce(
    (sum, val) => sum + (attributeCostMap[val] || 0),
    0
  );
});

const remainingPoints = computed(() => 27 - totalSpent.value);

// 方法：更新角色信息
function updateCharacterInfo() {
  console.log("角色信息已更新:", character);
}

// 方法：计算属性点并校验
function calculatePoints() {
  if (remainingPoints.value < 0) {
    showError.value = true;
    restorePreviousValues();
  } else {
    showError.value = false;
    // 更新上一次的有效值
    Object.keys(attributes).forEach((key) => {
      previousValues[key] = attributes[key];
    });
  }
}

// 方法：恢复上一次有效值
function restorePreviousValues() {
  Object.keys(previousValues).forEach((key) => {
    attributes[key] = previousValues[key];
  });
}
</script>

<style scoped>
.module {
  background-color: #fff;
  border: 1px solid #ccc;
  padding: 15px;
  margin-bottom: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

h3 {
  margin-top: 0;
}

label {
  display: inline-block;
  width: 120px;
  margin: 5px 0;
}

input[type="number"] {
  width: 50px;
  padding: 5px;
  margin-left: 10px;
}

.output {
  margin-top: 15px;
  background-color: #e9e9e9;
  padding: 10px;
  border-radius: 6px;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
}

th,
td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: center;
}

th {
  background-color: #f2f2f2;
}

.error {
  color: red;
  font-weight: bold;
}
</style>