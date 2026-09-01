<template>
  <div class="combat-tool">
    <div class="grid-container">
      <!-- 第一部分：状态选择 + 名称 + HP + 临时HP + AC + 攻击优势 + 防御优势 -->
      <div class="first-row">
        <h3>基础</h3>
        <!-- 状态选择 -->
        <div class="form-group state-select">
          <select
            id="state-select"
            v-model.number="currentId"
            @change="saveCurrentState"
          >
            <option v-for="state in states" :key="state.id" :value="state.id">
              {{ state.name }}
            </option>
          </select>
          <button @click="addNewState">+ 添加新状态</button>
        </div>

        <!-- 当前状态名称 -->
        <div class="form-group state-name">
          <label>当前状态名称</label>
          <input type="text" v-model="currentStateName" />
        </div>

        <div class="hp-temp-ac-group">
          <!-- HP (当前/总) -->
          <div class="form-group hp-input">
            <label>HP</label>
            <div class="hp-flex">
              <input type="number" v-model.number="currentStateHpCurrent" /> /
              <input type="number" v-model.number="currentStateHpMax" />
            </div>
          </div>

          <!-- 临时生命值 -->
          <div class="form-group temp-hp">
            <label>临时</label>
            <input type="number" v-model.number="currentStateTempHp" />
          </div>

          <!-- AC -->
          <div class="form-group ac-input">
            <label>AC</label>
            <input type="number" v-model.number="currentStateAc" />
          </div>
        </div>

        <!-- 熟练加值 -->
        <div class="form-group attack-advantage">
          <label>熟练加值</label>
          <input type="number" v-model.number="currentStateSkilledBonus" />
        </div>
        <!-- 攻击是否优势 -->
        <div class="form-group attack-advantage">
          <label>攻击是否优势</label>
          <select v-model="currentStateAttackAdvantage">
            <option value="no">否</option>
            <option value="yes">是</option>
          </select>
        </div>

        <!-- 防御是否优势 -->
        <div class="form-group defense-advantage">
          <label>防御是否优势</label>
          <select v-model="currentStateDefenseAdvantage">
            <option value="no">否</option>
            <option value="yes">是</option>
          </select>
        </div>
      </div>

      <!-- 资源表格 -->
      <div class="table-section">
        <h3>资源管理</h3>
        <table class="resource-table">
          <thead>
            <tr>
              <th>名字</th>
              <th>可用</th>
              <th>总数</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, index) in currentStateResources" :key="index">
              <td><input type="text" v-model="row.name" /></td>
              <td><input type="number" v-model.number="row.available" /></td>
              <td><input type="number" v-model.number="row.total" /></td>
              <td><button @click="removeResource(index)">删除</button></td>
            </tr>
          </tbody>
        </table>
        <button @click="addResource">+ 添加资源</button>
      </div>

      <!-- 武器表格 -->
      <div class="table-section">
        <h3>武器管理（最多5把）</h3>
        <table class="weapon-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>命中加值</th>
              <th>基础伤害</th>
              <th>属性加值</th>
              <th>熟练加值</th>
              <th>当前武器</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(weapon, index) in currentStateWeapons" :key="index">
              <td><input type="text" v-model="weapon.name" /></td>
              <td><input type="number" v-model.number="weapon.hitBonus" /></td>
              <td><input type="text" v-model="weapon.baseDamage" /></td>
              <td>
                <input type="number" v-model.number="weapon.attributeBonus" />
              </td>
              <td>
                <input type="number" v-model.number="weapon.proficiencyBonus" />
              </td>
              <td>
                <input
                  type="radio"
                  v-model.number="currentStateCurrentWeaponIndex"
                  :value="index"
                />
              </td>
            </tr>
          </tbody>
        </table>
        <button @click="addWeapon" :disabled="currentStateWeapons.length >= 5">
          + 添加武器
        </button>
      </div>

      <!-- 攻击检定 -->
      <div class="action-buttons">
        <table class="weapon-table">
          <thead>
            <tr>
              <th>操作</th>
              <th>公式表达式</th>
              <th>复制</th>
            </tr>
          </thead>
          <tbody>
            <!-- 攻击检定 -->
            <tr>
              <td>
                <button @click="rollAttack">攻击检定</button>
              </td>
              <td>
                <code class="formula" v-if="attackResult">{{
                  attackResult
                }}</code>
              </td>
              <td>
                <button
                  v-if="attackResult"
                  class="copy-btn"
                  @click.stop="copyToClipboard(attackResult)"
                >
                  复制
                </button>
              </td>
            </tr>

            <!-- 伤害计算 -->
            <tr>
              <td>
                <button @click="calculateDamage">伤害计算</button>
              </td>
              <td>
                <code class="formula" v-if="damageFormula">{{
                  damageFormula
                }}</code>
              </td>
              <td>
                <button
                  v-if="damageFormula"
                  class="copy-btn"
                  @click.stop="copyToClipboard(damageFormula)"
                >
                  复制
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 属性表格 -->
      <div class="table-section">
        <h3>属性值</h3>
        <table class="resource-table">
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
            <tr v-for="(attr, index) in currentAttributes" :key="index">
              <td>{{ attr.name }}</td>
              <td>
                <input
                  type="number"
                  v-model.number="attr.base"
                  @input="updateCalculatedValues(attr)"
                />
              </td>
              <td>{{ attr.modifier }}</td>
              <td>
                <input
                  type="checkbox"
                  v-model="attr.proficient"
                  @change="updateCalculatedValues(attr)"
                />
              </td>
              <td>{{ calculateSave(attr) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 技能表格 -->
      <div class="table-section">
        <h3>技能</h3>
        <table class="skills-table">
          <thead>
            <tr>
              <th>技能</th>
              <th>技能归属</th>
              <th>熟练程度</th>
              <th>总值</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(skill, index) in currentSkills" :key="index">
              <td>{{ skill.name }}</td>
              <td>{{ skill.ability }}</td>
              <td>
                <select
                  v-model="skill.proficiency"
                  @change="updateCalculatedValues"
                >
                  <option value="untrained">未熟练</option>
                  <option value="proficient">熟练</option>
                  <option value="expert">专家</option>
                </select>
              </td>
              <td>{{ skill.total }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="combat-log">
      <!-- 状态展示 -->
      <div class="status">
        <button
          v-if="currentState"
          class="copy-btn"
          @click.stop="copyToClipboard(JSON.stringify(currentState))"
        >复制</button>
        <p><strong>当前状态详情：</strong></p>
        <pre>{{ currentState }}</pre>
      </div>
    </div>
  </div>
</template>
  <script setup>
import { ref, computed, watch, onMounted } from "vue";
import { ElMessage } from "element-plus";
const STORAGE_KEY = "dnd-combat-states";

// 状态定义
const createEmptyState = (id) => ({
  id,
  name: "",
  hp: { current: 0, max: 0 },
  tempHp: 0,
  ac: 10,
  skilledBonus: 1,
  attackAdvantage: "no",
  defenseAdvantage: "no",
  resources: [],
  weapons: [],
  currentWeaponIndex: 0,
  attributes: [
    { name: "力量", base: 8, modifier: -1, proficient: false },
    { name: "敏捷", base: 8, modifier: -1, proficient: false },
    { name: "体质", base: 8, modifier: -1, proficient: false },
    { name: "智力", base: 8, modifier: -1, proficient: false },
    { name: "感知", base: 8, modifier: -1, proficient: false },
    { name: "魅力", base: 8, modifier: -1, proficient: false },
  ],
  skills: [
    { name: "运动", ability: "力量", proficiency: "untrained", total: 0 },
    { name: "特技", ability: "敏捷", proficiency: "untrained", total: 0 },
    { name: "巧手", ability: "敏捷", proficiency: "untrained", total: 0 },
    { name: "隐匿", ability: "敏捷", proficiency: "untrained", total: 0 },
    { name: "调查", ability: "智力", proficiency: "untrained", total: 0 },
    { name: "奥秘", ability: "智力", proficiency: "untrained", total: 0 },
    { name: "历史", ability: "智力", proficiency: "untrained", total: 0 },
    { name: "自然", ability: "智力", proficiency: "untrained", total: 0 },
    { name: "宗教", ability: "智力", proficiency: "untrained", total: 0 },
    { name: "察觉", ability: "感知", proficiency: "untrained", total: 0 },
    { name: "洞悉", ability: "感知", proficiency: "untrained", total: 0 },
    { name: "驯兽", ability: "感知", proficiency: "untrained", total: 0 },
    { name: "医药", ability: "感知", proficiency: "untrained", total: 0 },
    { name: "求生", ability: "感知", proficiency: "untrained", total: 0 },
    { name: "游说", ability: "魅力", proficiency: "untrained", total: 0 },
    { name: "欺瞒", ability: "魅力", proficiency: "untrained", total: 0 },
    { name: "威吓", ability: "魅力", proficiency: "untrained", total: 0 },
    { name: "表演", ability: "魅力", proficiency: "untrained", total: 0 },
  ],
});

const states = ref([]);
const currentId = ref(1);

// 获取当前状态
const currentState = computed(() => {
  const state = states.value.find((s) => s.id === currentId.value);
  return state || createEmptyState(0);
});

// 创建一个通用的计算属性工厂函数
const createSyncRef = (key, defaultValue = null) => {
  return computed({
    get: () => {
      if (!currentState.value) return defaultValue;

      // 处理嵌套属性
      if (key.includes(".")) {
        const keys = key.split(".");
        let value = currentState.value;
        for (const k of keys) {
          if (value == null) return defaultValue;
          value = value[k];
        }
        return value ?? defaultValue;
      }

      // 处理普通属性
      return currentState.value[key] ?? defaultValue;
    },
    set: (val) => {
      if (currentState.value) {
        // 处理嵌套属性
        if (key.includes(".")) {
          const keys = key.split(".");
          let target = currentState.value;
          for (let i = 0; i < keys.length - 1; i++) {
            if (!target[keys[i]]) target[keys[i]] = {};
            target = target[keys[i]];
          }
          target[keys[keys.length - 1]] = val;
        } else {
          // 处理普通属性
          currentState.value[key] = val;
        }
      }
    },
  });
};

// 使用工厂函数创建计算属性
const currentStateName = createSyncRef("name", "");
const currentStateHpCurrent = createSyncRef("hp.current", 0);
const currentStateHpMax = createSyncRef("hp.max", 0);
const currentStateTempHp = createSyncRef("tempHp", 0);
const currentStateAc = createSyncRef("ac", 10);
const currentStateSkilledBonus = createSyncRef("skilledBonus", 1);
const currentStateAttackAdvantage = createSyncRef("attackAdvantage", "no");
const currentStateDefenseAdvantage = createSyncRef("defenseAdvantage", "no");
const currentStateResources = createSyncRef("resources", []);
const currentStateWeapons = createSyncRef("weapons", []);
const currentStateCurrentWeaponIndex = createSyncRef("currentWeaponIndex", 0);

// 优化版本 - 添加类型检查
const currentAttributes = computed({
  get: () => {
    const attrs = currentState.value?.attributes;
    return Array.isArray(attrs) ? attrs : createEmptyState(0).attributes;
  },
  set: (val) => {
    if (currentState.value) {
      // 确保设置的是数组
      currentState.value.attributes = Array.isArray(val) ? val : [];
      // 更新计算值
      updateCalculatedValues();
    }
  },
});

const currentSkills = computed({
  get: () => {
    const skills = currentState.value?.skills;
    return Array.isArray(skills) ? skills : createEmptyState(0).skills;
  },
  set: (val) => {
    if (currentState.value) {
      // 确保设置的是数组
      currentState.value.skills = Array.isArray(val) ? val : [];
      // 更新计算值
      updateCalculatedValues();
    }
  },
});

// ... 其余代码保持不变

// 计算属性调整值
function calculateAttributeModifier(base) {
  return Math.floor(base / 2) - 5;
}

// 计算豁免值
function calculateSave(attr) {
  let save = attr.modifier || 0;
  if (attr.proficient) {
    save += currentState.value?.skilledBonus || 0;
  }
  return save;
}

// 计算技能总值
function calculateSkillTotal(skill) {
  if (!currentState.value) return 0;

  // 找到对应的属性
  const attr = currentAttributes.value.find((a) => a.name === skill.ability);
  if (!attr) return 0;

  let total = attr.modifier || 0;
  const bonus = currentState.value.skilledBonus || 0;

  switch (skill.proficiency) {
    case "proficient":
      total += bonus;
      break;
    case "expert":
      total += bonus * 2;
      break;
  }

  return total;
}

// 更新所有计算值
function updateCalculatedValues() {
  if (!currentState.value) return;

  // 确保属性和技能数组存在
  if (!currentState.value.attributes) {
    currentState.value.attributes = createEmptyState(0).attributes;
  }
  if (!currentState.value.skills) {
    currentState.value.skills = createEmptyState(0).skills;
  }

  // 更新属性调整值
  currentState.value.attributes.forEach((attr) => {
    attr.modifier = calculateAttributeModifier(attr.base);
  });

  // 更新技能总值
  currentState.value.skills.forEach((skill) => {
    skill.total = calculateSkillTotal(skill);
  });
}

// 监听状态变化
watch(
  () => currentState.value,
  (newVal) => {
    if (newVal && newVal.id > 0) {
      saveStatesToLocalStorage();
      updateCalculatedValues();
    }
  },
  { deep: true }
);

// 监听熟练加值变化
watch(
  () => currentState.value?.skilledBonus,
  () => {
    updateCalculatedValues();
  }
);

// 初始化状态
onMounted(() => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // 确保每个状态都有完整的属性和技能数据
      states.value = parsed.map((state) => {
        return {
          ...createEmptyState(state.id),
          ...state,
        };
      });
      currentId.value = parsed.length > 0 ? parsed[0].id : 1;
    } catch (e) {
      console.error("加载保存的状态失败", e);
      states.value = [createEmptyState(1)];
    }
  } else {
    states.value = [createEmptyState(1)];
  }

  // 确保当前状态存在并更新计算值
  if (currentState.value) {
    updateCalculatedValues();
  }
});
// 监听整个 currentState 变化并自动保存
watch(
  () => currentState.value,
  (newVal) => {
    if (newVal && newVal.id > 0) {
      saveStatesToLocalStorage();
    }
  },
  { deep: true }
);

// 初始化状态
onMounted(() => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      states.value = parsed;
      currentId.value = parsed.length > 0 ? parsed[0].id : 1;
      // 初始化时更新所有计算值
      states.value.forEach((state) => {
        updateCalculatedValuesForState(state);
      });
    } catch (e) {
      console.error("加载保存的状态失败", e);
      states.value = [createEmptyState(1)];
    }
  } else {
    states.value = [createEmptyState(1)];
  }
});

function calculateSkill(skill) {
  // 这里需要定义技能与属性的映射关系
  // 例如：特技-敏捷，运动-力量等
  // 根据熟练程度计算总值
  let proficiencyBonus = 0;
  switch (skill.proficiency) {
    case "proficient":
      proficiencyBonus = this.skilledBonus;
      break;
    case "expert":
      proficiencyBonus = this.skilledBonus * 2;
      break;
    default:
      proficiencyBonus = 0;
  }
}
// 为单个状态更新计算值
function updateCalculatedValuesForState(state) {
  if (!state) return;

  // 更新属性
  state.attributes.forEach((attr) => {
    attr.modifier = calculateAttributeModifier(attr.base);
  });

  // 更新技能
  state.skills.forEach((skill) => {
    skill.total = calculateSkillTotal(skill);
  });
}

// 添加新状态
function addNewState() {
  const newId = Math.max(...states.value.map((s) => s.id), 0) + 1;
  const newState = createEmptyState(newId);
  states.value.push(newState);
  currentId.value = newId;
  updateCalculatedValues();
}

// 添加资源
function addResource() {
  currentState.value.resources.push({ name: "", available: 0, total: 0 });
}
function removeResource(index) {
  currentState.value.resources.splice(index, 1);
}

// 添加武器
function addWeapon() {
  if (currentState.value.weapons.length >= 5) return;
  currentState.value.weapons.push({
    name: "",
    hitBonus: 0,
    baseDamage: "",
    attributeBonus: 0,
    proficiencyBonus: 0,
  });
}

// 保存函数
function saveStatesToLocalStorage() {
  try {
    const validStates = states.value.filter((state) => state.id > 0);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(validStates));
  } catch (e) {
    console.error("保存失败", e);
  }
}
// 攻击检定
function rollAttack() {
  const state = currentState.value;
  if (!state) return;

  const weaponIndex = state.currentWeaponIndex ?? 0;
  const weapon = state.weapons?.[weaponIndex];

  if (!weapon) {
    attackResult.value = "请先选择一个武器";
    return;
  }

  const { hitBonus, attributeBonus, proficiencyBonus } = weapon;

  // 计算总加值 x
  const totalBonus = hitBonus + attributeBonus + proficiencyBonus;

  // 根据是否优势生成公式
  if (state.attackAdvantage === "yes") {
    attackResult.value = `.r2d20+${totalBonus}`;
  } else {
    attackResult.value = `.rd20+${totalBonus}`;
  }
}

const attackResult = ref(null);
const damageFormula = ref(null);
// 伤害计算
function calculateDamage() {
  const state = currentState.value;
  if (!state) return;

  const weaponIndex = state.currentWeaponIndex ?? 0;
  const weapon = state.weapons?.[weaponIndex];

  if (!weapon) {
    damageFormula.value = "请先选择一个武器";
    return;
  }

  const { baseDamage, attributeBonus, proficiencyBonus } = weapon;

  let formula = `.r${baseDamage}`;

  if (attributeBonus !== 0 || proficiencyBonus !== 0) {
    const bonus = attributeBonus;
    formula += bonus >= 0 ? `+${bonus}` : `${bonus}`;
  }

  damageFormula.value = formula;
}
function copyToClipboard(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      console.log(1);
      ElMessage.success("已复制到剪贴板");
    })
    .catch((err) => {
      console.error("复制失败", err);
      ElMessage.error("复制失败，请重试");
    });
}
</script>

<style scoped>
input,
select {
  padding: 6px;
  font-size: 1rem;
  width: 100%;
}
.flex.gap-2 {
  display: flex;
  align-items: center;
  gap: 8px;
}

.resource-table,
.weapon-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1rem;
}
.resource-table th,
.resource-table td,
.weapon-table th,
.weapon-table td {
  border: 1px solid #ccc;
  padding: 8px;
  text-align: left;
}
.resource-table input,
.weapon-table input {
  width: 100%;
  box-sizing: border-box;
  min-width: 4rem;
}

.attack-action,
.damage-action {
  display: flex;
  align-items: center;
  gap: 10px;
}

.result {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  background-color: #f1f1f1;
  border-radius: 4px;
  font-size: 14px;
}

.formula {
  font-family: monospace;
  color: #2c3e50;
}

.copy-btn {
  font-size: 12px;
  padding: 2px 6px;
  cursor: pointer;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 3px;
}
.copy-btn:hover {
  background-color: #0056b3;
}

.status {
  margin-top: 2rem;
  background-color: #f9f9f9;
  padding: 10px;
  border-radius: 4px;
  overflow-x: auto;
}
.combat-tool {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(800px, 1fr));
  gap: 20px;
  padding: 20px;
}

.grid-container {
  display: flex;
  flex-wrap: wrap;
  justify-content: start;
  align-items: center;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.table-section {
  display: flex;
  flex-direction: column;
}

.resource-table,
.weapon-table {
  width: 100%;
  border-collapse: collapse;
}

.resource-table th,
.weapon-table th,
.resource-table td,
.weapon-table td {
  border: 1px solid #ddd;
  padding: 8px;
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  min-width: 240px;
}

.copy-btn {
  margin-left: 10px;
}

.status {
  background-color: #f9f9f9;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

@media (max-width: 768px) {
  .combat-tool {
    grid-template-columns: 1fr;
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  min-width: 120px;
  flex: 1 1 auto;
}

/* 特定项宽度控制 */
.state-select {
  min-width: 160px;
  flex: 0 0 auto;
}
.state-name {
  min-width: 140px;
  flex: 0 0 auto;
}
.hp-input {
  min-width: 130px;
  flex: 0 0 auto;
}
.temp-hp {
  min-width: 60px;
  flex: 0 0 auto;
}
.ac-input {
  min-width: 100px;
  flex: 0 0 auto;
}

/* 输入框样式优化 */
input[type="number"],
input[type="text"],
select {
  padding: 6px 8px;
  font-size: 14px;
  height: 30px;
  box-sizing: border-box;
}
/* 新增：HP + 临时HP + AC 的容器 */
.hp-temp-ac-group {
  display: flex;
  gap: 10px; /* 间距更小 */
  align-items: flex-start;
}

/* 减小每个表单项的宽度 */
.hp-input,
.temp-hp,
.ac-input {
  min-width: 90px; /* 更紧凑 */
  flex: 1 1 auto;
}

/* HP 输入框对更紧凑 */
.hp-flex {
  display: flex;
  align-items: center;
  gap: 2px;
}

.hp-flex input {
  width: 40px;
  text-align: center;
  font-size: 12px;
  padding: 4px 2px;
}
.first-row {
  max-width: 300px;
}
.skills-table select {
  padding: 5px;
  border-radius: 4px;
  border: 1px solid #ddd;
}
</style>