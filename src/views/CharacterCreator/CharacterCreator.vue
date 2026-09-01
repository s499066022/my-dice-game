<template>
  <div class="character-creator">
    <!-- 1. 角色基础信息 -->
    <CharacterInfoPanel
      v-model:character="character"
      :proficiency-bonus="currentProficiencyBonus"
    />

    <!-- 2. 属性点分配 -->
    <AttributeAllocationPanel
      v-model:attributes="attributes"
      :remaining-points="remainingPoints"
      :show-error="showError"
      @calculate-points="calculatePoints"
    />

    <!-- 3. 豁免检定表格 -->
    <SavingThrowTable :saving-throw-data="savingThrowData" />

    <!-- 4. 技能选择与检定 -->
    <SkillSelectionPanel
      :key="character.class"
      :available-skills="availableSkills"
      :max-skill-selection="maxSkillSelection"
      :selected-skills="selectedSkills"
      :skill-table-data="skillTableData"
      @toggle-skill="toggleSkill"
    />

    <!-- 5. 导出角色卡 -->
    <CharacterExportButton
      :disabled="remainingPoints !== 0"
      @confirm-character="confirmCharacter"
    />
  </div>
</template>
<script lang="ts" setup>
import { ref, reactive, computed, watch } from "vue";
import CharacterInfoPanel from "./components/CharacterInfoPanel.vue";
import AttributeAllocationPanel from "./components/AttributeAllocationPanel.vue";
import SavingThrowTable from "./components/SavingThrowTable.vue";
import SkillSelectionPanel from "./components/SkillSelectionPanel.vue";
import CharacterExportButton from "./components/CharacterExportButton.vue";

// ========== 基础角色信息 ==========
let character = reactive({
  name: "",
  class: "Fighter",
  level: 1,
});

// ========== 属性点分配 ==========
let attributes = reactive({
  strength: 8,
  dexterity: 8,
  constitution: 8,
  intelligence: 8,
  wisdom: 8,
  charisma: 8,
});

const previousValues = reactive({ ...attributes });
const showError = ref(false);

// ========== 职业数据加载 ==========
const classData = ref<any>(null);
const loading = ref(false);

const loadClassData = async (className: string) => {
  try {
    loading.value = true;
    const response = await fetch(`/characterData/all_class/${className}.json`);
    if (!response.ok) throw new Error("JSON 加载失败");
    classData.value = await response.json();
  } catch (error) {
    console.error("职业数据加载失败:", error);
    classData.value = null;
  } finally {
    loading.value = false;
  }
};

loadClassData(character.class);
watch(
  () => character.class,
  (newClass) => loadClassData(newClass)
);

// ========== 计算熟练加值 ==========
const currentProficiencyBonus = computed(() => {
  if (!classData.value?.features) return 0;
  const feature = classData.value.features.find((f: any) => f.level === character.level);
  return feature ? parseInt(feature.proficiencyBonus.replace("+", ""), 10) || 0 : 0;
});

// ========== 属性点花费计算 ==========
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

const totalSpent = computed(() => {
  return Object.values(attributes).reduce(
    (sum, val) => sum + (attributeCostMap[val as keyof typeof attributeCostMap] || 0),
    0
  );
});

const remainingPoints = computed(() => 27 - totalSpent.value);

// ========== 方法 ==========
function calculatePoints() {
  if (remainingPoints.value < 0) {
    showError.value = true;
    restorePreviousValues();
  } else {
    showError.value = false;
    Object.keys(attributes).forEach((key) => {
      previousValues[key] = attributes[key];
    });
  }
}

function restorePreviousValues() {
  Object.keys(previousValues).forEach((key) => {
    attributes[key] = previousValues[key];
  });
}

function confirmCharacter() {
  if (remainingPoints.value !== 0) {
    alert("请先完成属性点分配，剩余点数必须为0！");
    return;
  }

  const data = buildFullCharacterData();
  const dataStr = JSON.stringify(data, null, 2);
  const blob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "one.json";
  a.click();

  URL.revokeObjectURL(url);

  // 同步保存到「角色卡资源管理」库
  saveToCardLibrary(data);
}

// 职业中文名映射（用于资源库展示）
const CLASS_NAMES: Record<string, string> = {
  Barbarian: "野蛮人",
  Fighter: "战士",
};

// 将创建的角色同步保存到「角色卡资源管理」页面
function saveToCardLibrary(data: any) {
  const key = "dnd-character-cards";
  let list: any[] = [];
  try {
    const saved = localStorage.getItem(key);
    if (saved) list = JSON.parse(saved);
    if (!Array.isArray(list)) list = [];
  } catch (e) {
    list = [];
  }

  const con = data.attributes?.constitution ?? 10;
  const conMod = Math.floor((con - 10) / 2);
  const level = data.character?.level ?? 1;
  const maxHp = 10 + level * (1 + conMod);
  const now = new Date().toISOString();

  const card = {
    id: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
    name: data.character?.name || "未命名角色",
    className: CLASS_NAMES[data.character?.class] || data.character?.class || "",
    level,
    classes: [
      {
        id: Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8),
        name: CLASS_NAMES[data.character?.class] || data.character?.class || "",
        level,
      },
    ],
    hp: { current: maxHp, max: maxHp },
    tempHp: 0,
    ac: 10,
    proficiencyBonus: data.character?.proficiencyBonus ?? 2,
    initiativeBonus: 0,
    initiativeAdvantage: "normal",
    resources: [],
    note: "",
    creatorData: data,
    createdAt: now,
    updatedAt: now,
  };
  list.push(card);
  localStorage.setItem(key, JSON.stringify(list));
  alert("角色已同步保存到「角色卡资源管理」页面，可在该页面继续配置 HP / 资源！");
}

// ========== 构建完整角色数据 ==========
const buildFullCharacterData = () => {
  return {
    character: {
      ...character,
      proficiencyBonus: currentProficiencyBonus.value,
    },
    attributes: { ...attributes },
    skills: {
      selected: selectedSkills.value,
      details: skillTableData.value,
    },
    features: currentFeatures.value || [],
    createdAt: new Date().toISOString(),
  };
};

// ========== 当前等级特性 ==========
const currentFeatures = computed(() => {
  if (!classData.value?.features) return [];
  return classData.value.features.filter((f: any) => f.level <= character.level);
});

// ========== 技能相关 ==========
const availableSkills = computed(() => {
  return classData.value?.coreTraits?.skills?.options || [];
});

const maxSkillSelection = computed(() => {
  return classData.value?.coreTraits?.skills?.choose || 0;
});

const selectedSkills = ref<string[]>([]);

function toggleSkill(skill: string) {
  console.log("toggleSkill called with:", skill);
  const index = selectedSkills.value.indexOf(skill);
  if (index === -1 && selectedSkills.value.length < maxSkillSelection.value) {
    selectedSkills.value.push(skill);
  } else if (index > -1) {
    selectedSkills.value.splice(index, 1);
  }
}

// ========== 技能映射表 ==========
const skillToAbilityMap: Record<string, string> = {
  运动: "strength",
  特技: "dexterity",
  巧手: "dexterity",
  隐匿: "dexterity",
  调查: "intelligence",
  奥秘: "intelligence",
  历史: "intelligence",
  宗教: "intelligence",
  察觉: "wisdom",
  洞悉: "wisdom",
  驯兽: "wisdom",
  医药: "wisdom",
  求生: "wisdom",
  游说: "charisma",
  欺瞒: "charisma",
  威吓: "charisma",
  表演: "charisma",
};

function translateAbility(key: string): string {
  const map: Record<string, string> = {
    strength: "力量",
    dexterity: "敏捷",
    constitution: "体质",
    intelligence: "智力",
    wisdom: "感知",
    charisma: "魅力",
  };
  return map[key] || key;
}

// ========== 技能检定表格 ==========
const skillTableData = computed(() => {
  if (!classData.value) return [];

  const data = [];
  for (const skill of Object.keys(skillToAbilityMap)) {
    const abilityKey = skillToAbilityMap[skill] as keyof typeof attributes;
    const baseValue = attributes[abilityKey];
    const modifier = Math.floor((baseValue - 10) / 2);
    const isProficient = selectedSkills.value.includes(skill);
    const totalValue = isProficient
      ? modifier + currentProficiencyBonus.value
      : modifier;

    data.push({
      name: skill,
      ability: translateAbility(abilityKey),
      modifier,
      isProficient,
      totalValue,
    });
  }

  return data;
});

// ========== 豁免检定 ==========
const savingThrowData = computed(() => {
  if (!classData.value) return [];

  const data: any[] = [];
  const abilities = [
    "strength",
    "dexterity",
    "constitution",
    "intelligence",
    "wisdom",
    "charisma",
  ];

  for (const ability of abilities) {
    const value = attributes[ability as keyof typeof attributes];
    const modifier = Math.floor((value - 10) / 2);
    const isProficient =
      classData.value?.coreTraits?.savingThrows?.[ability] || false;
    const saveValue = isProficient
      ? modifier + currentProficiencyBonus.value
      : modifier;

    data.push({
      name: ability,
      displayName: translateAbility(ability),
      value,
      modifier,
      isProficient,
      saveValue,
    });
  }

  return data;
});
</script>
<style scoped>
.character-creator {
  padding: 20px;
  font-family: Arial, sans-serif;
}
</style>