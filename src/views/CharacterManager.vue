<template>
  <div class="character-manager">
    <div class="cm-header">
      <h2>🗂️ 角色卡资源管理</h2>
      <p class="hint">
        完整 5e 角色卡：属性 / 豁免、战斗（HP、先攻、命中骰、狂暴次数等资源）、技能、武器防具、特性专长、法术、财富。
        数据优先保存到 PHP 后端；后端不可用时自动回退浏览器本地存储。
      </p>
      <div class="cm-toolbar">
        <el-button type="primary" @click="addCard">＋ 新建角色卡</el-button>
        <el-button @click="addSampleCharacters">🧪 示例角色</el-button>
        <el-button @click="importCardsFromFile">导入 JSON</el-button>
        <el-button v-if="cards.length" plain @click="exportAllCards">导出全部</el-button>
        <span v-if="cards.length" class="card-count">共 {{ cards.length }} 张角色卡</span>
      </div>
      <input ref="fileInput" type="file" accept="application/json,.json" style="display: none" @change="onImportFile" />

      <!-- 武器库管理 -->
      <el-dialog v-model="manageDialog" title="武器库管理" width="640px">
        <div v-if="!weaponLibrary.length" class="cm-library-empty">武器库为空。可从武器表「＋ 自定义武器」添加，或点击底部「恢复标准清单」。</div>
        <div v-else class="cm-table-wrap">
          <table class="cm-table">
            <thead>
              <tr><th>名称</th><th>精通</th><th>伤害</th><th>类型</th><th>金额</th><th>特性</th><th></th></tr>
            </thead>
            <tbody>
              <tr v-for="p in weaponLibrary" :key="presetKey(p)">
                <td>{{ p.name }}</td>
                <td>{{ p.mastery }}</td>
                <td>{{ p.damage }}</td>
                <td>{{ p.damageType }}</td>
                <td>{{ p.cost }}</td>
                <td>{{ p.traits }}</td>
                <td><el-button size="small" type="danger" text @click="deleteFromLibrary(p)">删除</el-button></td>
              </tr>
            </tbody>
          </table>
        </div>
        <template #footer>
          <el-button @click="restoreStandardWeapons">恢复标准清单</el-button>
          <el-button type="primary" @click="manageDialog = false">完成</el-button>
        </template>
      </el-dialog>

      <!-- 法术材料 / 效果 编辑 -->
      <el-dialog v-model="spellEditDialog" :title="'法术材料 / 效果 — ' + (spellEditTarget?.name || '法术')" width="560px">
        <div v-if="spellEditTarget" class="cm-spell-field">
          <label>具体施法材料</label>
          <el-input v-model="spellEditTarget.material" type="textarea" :rows="3" placeholder="具体施法材料…" />
        </div>
        <div v-if="spellEditTarget" class="cm-spell-field">
          <label>法术效果</label>
          <el-input v-model="spellEditTarget.effect" type="textarea" :rows="6" placeholder="法术效果…" />
        </div>
        <template #footer>
          <el-button type="primary" @click="spellEditDialog = false">完成</el-button>
        </template>
      </el-dialog>
    </div>

    <!-- 后端连接状态条 -->
    <div class="cm-backend">
      <el-tag :type="statusTagType" size="small">
        {{ statusLabel }}
      </el-tag>
      <el-input v-model="backendUrlInput" size="small" placeholder="后端地址，如 http://localhost:12226/api" class="cm-be-input" />
      <el-button size="small" @click="testConnection">测试连接</el-button>
      <el-button size="small" type="success" plain @click="pushToBackend(true)">
        立即同步
      </el-button>
      <span v-if="backendStatus.lastSync" class="cm-sync-time">上次同步 {{ backendStatus.lastSync }}</span>
    </div>

    <!-- 空状态 -->
    <div v-if="!cards.length" class="cm-empty">
      <p>还没有角色卡。</p>
      <p>点击「＋ 新建角色卡」手动创建，或在「角色卡创建器」中完成创建后自动出现在这里。</p>
    </div>

    <div v-else class="cm-layout">
      <!-- 左侧：角色卡列表 -->
      <aside class="cm-list">
        <div
          v-for="card in cards"
          :key="card.id"
          class="cm-card-item"
          :class="{ active: card.id === currentId }"
          @click="currentId = card.id"
        >
          <div class="cm-card-name">{{ card.name || '未命名角色' }}</div>
          <div class="cm-card-meta">
            <span v-if="classSummary(card)">{{ classSummary(card) }}</span>
            <span>HP {{ card.hp.current }}/{{ card.hp.max }}</span>
            <span>AC {{ getTotalAC(card) }}</span>
          </div>
          <div class="cm-card-actions" @click.stop>
            <el-button size="small" text @click="duplicateCard(card)">复制</el-button>
            <el-button size="small" text type="danger" @click="deleteCard(card)">删除</el-button>
          </div>
        </div>
      </aside>

      <!-- 右侧：详情编辑 -->
      <section v-if="currentCard" class="cm-detail">
        <!-- 顶部摘要 -->
        <div class="cm-detail-head">
          <el-input v-model="currentCard.name" class="cm-name-input" placeholder="角色名称" size="large" />
          <div class="cm-summary">
            <span v-if="classSummary(currentCard)" class="cm-sum-chip">{{ classSummary(currentCard) }}</span>
            <span class="cm-sum-chip">AC {{ totalAC }}</span>
            <span class="cm-sum-chip">熟练 +{{ currentCard.proficiencyBonus }}</span>
          </div>
          <div class="cm-detail-actions">
            <el-button size="small" type="primary" plain @click="sendToInitiative">🎲 加入先攻骰</el-button>
            <el-button size="small" plain @click="exportCard(currentCard)">导出 JSON</el-button>
            <el-button size="small" plain @click="duplicateCard(currentCard)">复制此卡</el-button>
          </div>
        </div>

        <el-tabs v-model="activeTab" class="cm-tabs">
          <!-- ============ 1. 基础 & 属性 ============ -->
          <el-tab-pane label="基础 / 属性" name="basic">
            <div class="cm-grid">
              <div class="cm-panel">
                <h4>基础信息</h4>
                <div class="cm-form-row"><label>玩家名</label><el-input v-model="currentCard.playerName" /></div>
                <div class="cm-form-row"><label>族裔</label><el-input v-model="currentCard.race" /></div>
                <div class="cm-form-row"><label>出身</label><el-input v-model="currentCard.background" /></div>
                <div class="cm-form-row"><label>阵营</label><el-input v-model="currentCard.alignment" /></div>
                <div class="cm-class-block">
                  <div class="cm-class-block-title">职业（支持多职业兼职）</div>
                  <div v-for="cl in currentCard.classes" :key="cl.id" class="cm-class-row">
                    <el-input v-model="cl.name" placeholder="职业，如 野蛮人" />
                    <el-input-number v-model="cl.level" :min="1" :max="20" controls-position="right" class="cm-class-level" />
                    <el-button size="small" type="danger" text @click="removeClass(cl)">删</el-button>
                  </div>
                  <div v-if="!currentCard.classes.length" class="cm-class-empty">暂无职业，点击下方添加。</div>
                  <div class="cm-class-actions">
                    <el-button size="small" @click="addClass">＋ 添加职业</el-button>
                    <span v-if="totalLevel" class="cm-class-total">总等级 {{ totalLevel }} 级</span>
                  </div>
                  <div class="cm-class-hint">可添加多个职业，总等级为各职业等级之和（如：野蛮人10级，圣武士2级）。</div>
                </div>
                <div class="cm-form-row"><label>经验值</label><el-input-number v-model="currentCard.xp" :min="0" /></div>
                <div class="cm-form-row"><label>熟练加值</label><el-input-number v-model="currentCard.proficiencyBonus" :min="0" :max="20" /></div>
              </div>
              <div class="cm-panel cm-panel-wide">
                <h4>属性与豁免</h4>
                <AbilityPanel :card="currentCard" />
              </div>
            </div>
          </el-tab-pane>

          <!-- ============ 2. 战斗 & 资源 ============ -->
          <el-tab-pane label="战斗 / 资源" name="combat">
            <div class="cm-grid">
              <div class="cm-panel">
                <h4>生命值</h4>
                <div class="hp-line">
                  <span class="hp-current" :class="{ danger: hpRatio < 0.5 }">{{ currentCard.hp.current }}</span>
                  <span class="hp-sep">/</span>
                  <span class="hp-max">{{ currentCard.hp.max }}</span>
                  <span class="hp-temp">临时 {{ currentCard.tempHp }}</span>
                </div>
                <div class="hp-bar"><div class="hp-fill" :style="{ width: hpPercent + '%' }"></div></div>
                <div class="cm-form-row"><label>当前</label><el-input-number v-model="currentCard.hp.current" :min="0" :max="99999" /></div>
                <div class="cm-form-row"><label>最大</label><el-input-number v-model="currentCard.hp.max" :min="0" :max="99999" @change="clampHp" /></div>
                <div class="cm-form-row"><label>临时</label><el-input-number v-model="currentCard.tempHp" :min="0" :max="99999" /></div>
                <div class="hp-buttons">
                  <el-button v-for="d in [-10, -5, -1, 1, 5, 10]" :key="d" size="small" :type="d < 0 ? 'danger' : 'success'" plain @click="adjustHp(d)">{{ d > 0 ? '+' : '' }}{{ d }}</el-button>
                </div>
                <el-button size="small" type="warning" plain class="long-rest" @click="longRest">☀️ 长休恢复（回满 HP 与资源）</el-button>
              </div>

              <div class="cm-panel">
                <h4>战斗属性</h4>
                <div class="cm-form-row"><label>AC 加值</label><el-input-number v-model="currentCard.acBonus" :min="0" :max="99" /></div>
                <div class="cm-form-row"><label>最终 AC</label>
                  <div class="cm-inline">
                    <span class="cm-static cm-init">{{ totalAC }}</span>
                    <span class="cm-formula">= 加值 {{ currentCard.acBonus || 0 }} + 护甲 {{ getArmorAC(currentCard) }} + 盾牌 {{ getShieldAC(currentCard) }}</span>
                  </div>
                </div>
                <div class="cm-form-row"><label>先攻加值</label><el-input-number v-model="currentCard.initiativeBonus" :min="-20" :max="30" /></div>
                <div class="cm-form-row"><label>先攻</label>
                  <div class="cm-inline">
                    <span class="cm-static cm-init">{{ initiativeTotal }}</span>
                    <span class="cm-formula">= 加值 {{ currentCard.initiativeBonus || 0 }} + 敏捷 {{ fmtMod(dexMod) }}</span>
                  </div>
                </div>
                <div class="cm-form-row"><label>先攻优劣</label>
                  <el-select v-model="currentCard.initiativeAdvantage" style="width: 130px">
                    <el-option value="normal" label="普通" /><el-option value="advantage" label="优势" /><el-option value="disadvantage" label="劣势" />
                  </el-select>
                </div>
                <div class="cm-form-row"><label>速度</label><el-input v-model="currentCard.speed" /></div>
                <div class="cm-form-row"><label>体型</label><el-input v-model="currentCard.size" /></div>
                <div class="cm-form-row"><label>生命骰</label>
                  <div class="cm-dice">
                    <el-input-number v-model="currentCard.hitDice.current" :min="0" size="small" />
                    <span>/</span>
                    <el-input-number v-model="currentCard.hitDice.max" :min="0" size="small" />
                    <el-input v-model="currentCard.hitDice.formula" size="small" style="width: 80px" placeholder="1d12" />
                  </div>
                </div>
                <div class="cm-form-row"><label>被动察觉</label>
                  <div class="cm-inline">
                    <el-input-number v-model="currentCard.passivePerception" :min="0" :max="99" />
                    <el-button size="small" text @click="recalcPassive">按察觉技能重算</el-button>
                  </div>
                </div>
              </div>

              <div class="cm-panel cm-panel-wide">
                <h4>状态 / 抗性</h4>
                <div class="cm-form-row"><label>抗性</label><el-input v-model="currentCard.resistances" placeholder="如：火焰" /></div>
                <div class="cm-form-row"><label>免疫</label><el-input v-model="currentCard.immunities" placeholder="如：毒素" /></div>
                <div class="cm-conditions">
                  <el-checkbox-group v-model="currentCard.conditions">
                    <el-checkbox v-for="c in CONDITION_OPTIONS" :key="c" :label="c">{{ c }}</el-checkbox>
                  </el-checkbox-group>
                </div>
              </div>

              <div class="cm-panel cm-panel-wide">
                <h4>资源（狂暴次数 / 斗气 / 充能 / 法术位等）</h4>
                <ResourceList :items="currentCard.resources" />
              </div>
            </div>
          </el-tab-pane>

          <!-- ============ 3. 技能 ============ -->
          <el-tab-pane label="技能" name="skills">
            <div class="cm-grid">
              <div class="cm-panel cm-panel-wide">
                <h4>技能</h4>
                <SkillPanel :card="currentCard" />
              </div>
              <div class="cm-panel">
                <h4>武具与护甲熟练</h4>
                <div class="cm-form-row"><label>武器</label><el-input v-model="currentCard.weaponsProficient" /></div>
                <div class="cm-form-row"><label>护甲</label><el-input v-model="currentCard.armorProficient" /></div>
                <div class="cm-form-row"><label>语言</label><el-input v-model="currentCard.languages" /></div>
                <div class="cm-form-row"><label>工具</label><el-input v-model="currentCard.tools" /></div>
              </div>
            </div>
          </el-tab-pane>

          <!-- ============ 4. 武器 & 防具 ============ -->
          <el-tab-pane label="武器 / 防具" name="equipment">
            <div class="cm-grid">
              <div class="cm-panel cm-panel-wide">
                <h4>武器</h4>
                <div class="cm-weapon-head">
                  <el-select v-model="weaponPresetSel" placeholder="从标准武器列表选择…" class="cm-weapon-preset" @change="onSelectWeaponPreset">
                    <el-option v-for="p in allPresetWeapons" :key="presetKey(p)" :value="presetKey(p)" :label="presetLabel(p)" />
                  </el-select>
                  <el-button size="small" @click="addWeapon">＋ 自定义武器</el-button>
                  <el-button size="small" plain @click="manageDialog = true">管理武器库</el-button>
                  <span class="cm-formula">命中加值 = 使用属性调整值 + 熟练加值；武器伤害 = 伤害区间 + 使用属性调整值</span>
                </div>
                <div class="cm-table-wrap">
                  <table class="cm-table">
                    <thead>
                      <tr>
                        <th>名称</th>
                        <th>精通</th>
                        <th>使用属性</th>
                        <th>伤害区间</th>
                        <th>伤害类型</th>
                        <th>特性</th>
                        <th>弹药</th>
                        <th>命中加值</th>
                        <th>武器伤害</th>
                        <th>⭐</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="w in currentCard.weapons" :key="w.id">
                        <td><el-input v-model="w.name" size="small" /></td>
                        <td><el-input v-model="w.mastery" size="small" style="width: 70px" /></td>
                        <td>
                          <el-select v-model="w.ability" size="small" style="width: 84px">
                            <el-option value="" label="—" />
                            <el-option v-for="k in ABILITY_KEYS" :key="k" :value="k" :label="ABILITY_LABELS[k]" />
                          </el-select>
                        </td>
                        <td><el-input v-model="w.damage" size="small" style="width: 64px" /></td>
                        <td><el-input v-model="w.damageType" size="small" style="width: 72px" /></td>
                        <td><el-input v-model="w.traits" size="small" /></td>
                        <td class="cm-num"><el-input-number v-model="w.ammo" :min="0" size="small" controls-position="right" /></td>
                        <td class="cm-hit">{{ getWeaponHitBonus(currentCard, w) }}</td>
                        <td class="cm-hit cm-dmg">{{ getWeaponDamageText(currentCard, w) }}</td>
                        <td><el-button size="small" text title="存入武器库" @click="saveWeaponToLibrary(w)">⭐</el-button></td>
                        <td><el-button size="small" type="danger" text @click="removeWeapon(w)">删</el-button></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="cm-panel cm-panel-wide">
                <h4>防具（护甲 + 盾牌）</h4>
                <div class="cm-ac-summary">
                  <span class="cm-ac-sum-label">最终 AC</span>
                  <strong class="cm-ac-total">{{ totalAC }}</strong>
                  <span class="cm-formula">= AC 加值 {{ currentCard.acBonus || 0 }} + 护甲 {{ getArmorAC(currentCard) }} + 盾牌 {{ getShieldAC(currentCard) }}</span>
                  <el-tag v-if="hasStealthDisadvantage(currentCard)" type="danger" size="small">隐匿劣势</el-tag>
                </div>

                <div class="cm-def">
                  <div class="cm-def-title">护甲</div>
                  <div class="cm-def-row">
                    <span class="cm-def-label">类型</span>
                    <el-select v-model="currentCard.armor.kind" style="width: 130px" @change="onArmorKindChange">
                      <el-option v-for="k in ARMOR_KINDS" :key="k" :value="k" :label="ARMOR_KIND_LABELS[k]" />
                    </el-select>
                  </div>
                  <div class="cm-def-row"><span class="cm-def-label">名称</span><el-input v-model="currentCard.armor.name" placeholder="如 铠甲" /></div>
                  <div class="cm-def-row"><span class="cm-def-label">AC 值</span><el-input-number v-model="currentCard.armor.ac" :min="0" :max="99" /></div>
                  <div class="cm-def-row"><span class="cm-def-label">备注</span><el-input v-model="currentCard.armor.note" /></div>
                  <div class="cm-def-row"><span class="cm-def-label">隐匿劣势</span><el-checkbox v-model="currentCard.armor.stealthDisadvantage" /></div>
                </div>

                <div class="cm-def">
                  <div class="cm-def-title">
                    盾牌
                    <el-checkbox v-model="currentCard.shield.equipped" class="cm-def-equip">装备</el-checkbox>
                  </div>
                  <div class="cm-def-row"><span class="cm-def-label">名称</span><el-input v-model="currentCard.shield.name" placeholder="如 木盾" /></div>
                  <div class="cm-def-row"><span class="cm-def-label">AC 值</span><el-input-number v-model="currentCard.shield.ac" :min="0" :max="99" :disabled="!currentCard.shield.equipped" /></div>
                  <div class="cm-def-row"><span class="cm-def-label">备注</span><el-input v-model="currentCard.shield.note" /></div>
                  <div class="cm-def-row"><span class="cm-def-label">隐匿劣势</span><el-checkbox v-model="currentCard.shield.stealthDisadvantage" /></div>
                </div>
              </div>

              <div class="cm-panel cm-panel-wide">
                <h4>装备栏（武器与防具，名称不可改）</h4>
                <div class="cm-table-wrap">
                  <table class="cm-table">
                    <thead>
                      <tr>
                        <th>名称</th>
                        <th>是否同调</th>
                        <th>描述</th>
                        <th>部位</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in equipmentRows" :key="row.key">
                        <td class="cm-eq-name">{{ row.name }}</td>
                        <td class="cm-eq-attune"><el-checkbox v-model="row.item.attuned" /></td>
                        <td><el-input v-model="row.item.description" size="small" placeholder="描述…" /></td>
                        <td class="cm-eq-slot">
                          <el-select v-model="row.item.slot" size="small" style="width: 100px">
                            <el-option v-for="s in EQUIP_SLOTS" :key="s" :value="s" :label="s" />
                          </el-select>
                        </td>
                      </tr>
                      <tr v-if="!equipmentRows.length">
                        <td colspan="4" class="cm-eq-empty">暂无武器或防具，请先在「武器」「防具」中添加。</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div class="cm-formula">提示：装备栏自动汇总本角色所有武器、护甲与盾牌；名称来自对应栏位，同调/描述/部位可在此填写。</div>
              </div>

              <div class="cm-panel cm-panel-wide">
                <h4>其他物品</h4>
                <table class="cm-table">
                  <thead>
                    <tr><th>名称</th><th>是否同调</th><th>描述</th><th>部位</th><th></th></tr>
                  </thead>
                  <tbody>
                    <tr v-for="e in currentCard.equipment" :key="e.id">
                      <td><el-input v-model="e.name" size="small" /></td>
                      <td class="cm-eq-attune"><el-checkbox v-model="e.attuned" /></td>
                      <td><el-input v-model="e.description" size="small" placeholder="描述…" /></td>
                      <td class="cm-eq-slot">
                        <el-select v-model="e.slot" size="small" style="width: 100px">
                          <el-option v-for="s in EQUIP_SLOTS" :key="s" :value="s" :label="s" />
                        </el-select>
                      </td>
                      <td><el-button size="small" type="danger" text @click="removeEquipment(e)">删</el-button></td>
                    </tr>
                  </tbody>
                </table>
                <el-button size="small" @click="addEquipment">＋ 添加其他物品</el-button>
              </div>
            </div>
          </el-tab-pane>

          <!-- ============ 5. 特性 / 专长 ============ -->
          <el-tab-pane label="特性 / 专长" name="features">
            <div class="cm-grid">
              <div class="cm-panel"><h4>职业特性</h4><FeatureList :items="currentCard.classFeatures" empty-text="暂无职业特性" add-text="职业特性" /></div>
              <div class="cm-panel"><h4>族系特性</h4><FeatureList :items="currentCard.racialFeatures" empty-text="暂无族系特性" add-text="族系特性" /></div>
              <div class="cm-panel"><h4>专长 / 属性值增进</h4><FeatureList :items="currentCard.feats" empty-text="暂无专长" add-text="专长" /></div>
              <div class="cm-panel"><h4>特殊能力</h4><FeatureList :items="currentCard.specialAbilities" empty-text="暂无特殊能力" add-text="特殊能力" /></div>
            </div>
          </el-tab-pane>

          <!-- ============ 6. 法术 ============ -->
          <el-tab-pane label="法术" name="spells">
            <div class="cm-grid">
              <div class="cm-panel">
                <h4>施法属性</h4>
                <div class="cm-form-row"><label>施法属性</label>
                  <el-select v-model="currentCard.spellAbility" style="width: 140px">
                    <el-option value="" label="无（不施法）" />
                    <el-option v-for="k in ABILITY_KEYS" :key="k" :value="k" :label="ABILITY_LABELS[k]" />
                  </el-select>
                </div>
                <div class="cm-form-row"><label>豁免 DC</label><el-input-number v-model="currentCard.spellDc" :min="0" :max="30" /></div>
                <div class="cm-form-row"><label>攻击加值</label><el-input-number v-model="currentCard.spellAttackBonus" :min="0" :max="30" /></div>
              </div>
              <div class="cm-panel">
                <h4>法术位</h4>
                <table class="cm-table">
                  <thead><tr><th>环</th><th>已用</th><th>上限</th></tr></thead>
                  <tbody>
                    <tr v-for="s in currentCard.spellSlots" :key="s.level">
                      <td>{{ s.level }}环</td>
                      <td class="cm-num"><el-input-number v-model="s.used" :min="0" :max="999" size="small" controls-position="right" /></td>
                      <td class="cm-num"><el-input-number v-model="s.total" :min="0" :max="999" size="small" controls-position="right" /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="cm-panel cm-panel-wide">
                <h4>法术列表（按环位 0-9 排列）</h4>
                <div class="cm-table-wrap">
                  <table class="cm-table">
                    <thead>
                      <tr>
                        <th>状态</th>
                        <th>LV</th>
                        <th>学派</th>
                        <th>仪式</th>
                        <th>法术名</th>
                        <th>施法时间</th>
                        <th>施法距离</th>
                        <th>持续时间</th>
                        <th>V</th>
                        <th>S</th>
                        <th>M</th>
                        <th>材料 / 效果</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="sp in sortedSpells" :key="sp.id">
                        <td>
                          <el-select v-model="sp.status" size="small" style="width: 84px">
                            <el-option v-for="st in SPELL_STATUSES" :key="st" :value="st" :label="st" />
                          </el-select>
                        </td>
                        <td class="cm-num"><el-input-number v-model="sp.level" :min="0" :max="9" size="small" controls-position="right" /></td>
                        <td><el-input v-model="sp.school" size="small" style="width: 64px" /></td>
                        <td class="cm-vsm"><el-checkbox v-model="sp.ritual" /></td>
                        <td><el-input v-model="sp.name" size="small" /></td>
                        <td><el-input v-model="sp.castingTime" size="small" style="width: 92px" /></td>
                        <td><el-input v-model="sp.range" size="small" style="width: 92px" /></td>
                        <td><el-input v-model="sp.duration" size="small" style="width: 92px" /></td>
                        <td class="cm-vsm"><el-checkbox v-model="sp.v" /></td>
                        <td class="cm-vsm"><el-checkbox v-model="sp.s" /></td>
                        <td class="cm-vsm"><el-checkbox v-model="sp.m" /></td>
                        <td><el-button size="small" text @click="openSpellDialog(sp)">📝 查看 / 编辑</el-button></td>
                        <td><el-button size="small" type="danger" text @click="removeSpell(sp)">删</el-button></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <el-button size="small" @click="addSpell">＋ 添加法术</el-button>
              </div>
            </div>
          </el-tab-pane>

          <!-- ============ 7. 财富 & 备注 ============ -->
          <el-tab-pane label="财富 / 备注" name="wealth">
            <div class="cm-grid">
              <div class="cm-panel">
                <h4>财富</h4>
                <div class="cm-form-row"><label>白金币</label><el-input-number v-model="currentCard.money.pp" :min="0" /></div>
                <div class="cm-form-row"><label>金币</label><el-input-number v-model="currentCard.money.gp" :min="0" /></div>
                <div class="cm-form-row"><label>银币</label><el-input-number v-model="currentCard.money.sp" :min="0" /></div>
                <div class="cm-form-row"><label>铜币</label><el-input-number v-model="currentCard.money.cp" :min="0" /></div>
                <div class="cm-form-row"><label>负重上限</label><el-input-number v-model="currentCard.weightCapacity" :min="0" /></div>
              </div>
              <div class="cm-panel cm-panel-wide">
                <h4>备注</h4>
                <el-input v-model="currentCard.note" type="textarea" :rows="6" placeholder="记录该角色的额外信息…" />
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </section>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AbilityPanel from '../components/character/AbilityPanel.vue'
import SkillPanel from '../components/character/SkillPanel.vue'
import ResourceList from '../components/character/ResourceList.vue'
import FeatureList from '../components/character/FeatureList.vue'
import type { CharacterCard } from '../data/dndModel'
import {
  createEmptyCard,
  normalizeCharacterCard,
  uid,
  CONDITION_OPTIONS,
  ABILITY_KEYS,
  ABILITY_LABELS,
  getSkillTotal,
  getClassSummary as classSummary,
  getTotalLevel,
  getAbilityModifier,
  getInitiativeTotal,
  getTotalAC,
  getArmorAC,
  getShieldAC,
  hasStealthDisadvantage,
  ARMOR_KINDS,
  ARMOR_KIND_LABELS,
  ARMOR_DEFAULT_AC,
  WEAPON_PRESETS,
  getWeaponHitBonus,
  getWeaponDamageText,
  defaultAbilityForWeapon,
} from '../data/dndModel'
import type { WeaponPreset, Spell } from '../data/dndModel'
import { createSampleCharacters, createRandomSampleCharacter } from '../data/sampleCharacters'
import {
  backendPing,
  backendFetchAll,
  backendReplaceAll,
  getBackendBase,
  setBackendBase,
  useBackendStatus,
} from '../api/characterBackend'

const STORAGE_KEY = 'dnd-character-cards'
const CURRENT_KEY = 'dnd-character-cards-current'
const SAMPLE_SEED_FLAG = 'dnd-sample-seeded'
const WEAPON_LIBRARY_KEY = 'dnd-weapon-library'
const LEGACY_CUSTOM_WEAPONS_KEY = 'dnd-custom-weapons'

const EQUIP_SLOTS = ['头部', '颈部', '肩部', '背部', '胸部', '腕部', '手部', '腰部', '腿部', '脚部', '其他']
const SPELL_STATUSES = ['未准备', '已准备', '已知', '常备', '专注']

const cards = ref<CharacterCard[]>([])
const currentId = ref('')
const activeTab = ref('basic')
const fileInput = ref<HTMLInputElement | null>(null)
const backendStatus = useBackendStatus()
const backendUrlInput = ref(getBackendBase())
const weaponPresetSel = ref('')
const weaponLibrary = ref<WeaponPreset[]>([])
const manageDialog = ref(false)
const spellEditDialog = ref(false)
const spellEditTarget = ref<Spell | null>(null)

const allPresetWeapons = computed(() => weaponLibrary.value)

function presetKey(p: WeaponPreset): string {
  return `${p.name}|${p.damage}|${p.damageType}`
}
function presetLabel(p: WeaponPreset): string {
  return `${p.name}  ${p.damage} ${p.damageType}  ${p.cost}  ${p.traits}`
}
function persistWeaponLibrary() {
  localStorage.setItem(WEAPON_LIBRARY_KEY, JSON.stringify(weaponLibrary.value))
}

function deleteFromLibrary(p: WeaponPreset) {
  const i = weaponLibrary.value.findIndex((x) => presetKey(x) === presetKey(p))
  if (i !== -1) weaponLibrary.value.splice(i, 1)
  persistWeaponLibrary()
  ElMessage.success(`已从武器库删除「${p.name || '武器'}」`)
}

function restoreStandardWeapons() {
  weaponLibrary.value = [...WEAPON_PRESETS]
  persistWeaponLibrary()
  ElMessage.success('已恢复标准武器清单')
}

type NormalizedCard = CharacterCard

const currentCard = computed(() => cards.value.find((c) => c.id === currentId.value) || null)

const hpPercent = computed(() => {
  const c = currentCard.value
  if (!c) return 0
  const max = c.hp.max || 1
  return Math.max(0, Math.min(100, (c.hp.current / max) * 100))
})
const hpRatio = computed(() => {
  const c = currentCard.value
  if (!c) return 1
  return c.hp.max > 0 ? c.hp.current / c.hp.max : 1
})

const dexMod = computed(() => (currentCard.value ? getAbilityModifier(currentCard.value, 'dex') : 0))
const initiativeTotal = computed(() => (currentCard.value ? getInitiativeTotal(currentCard.value) : 0))
const totalAC = computed(() => (currentCard.value ? getTotalAC(currentCard.value) : 0))

// 装备栏 = 全部武器 + 护甲 + 盾牌（名称只读，可改同调/描述）
const equipmentRows = computed(() => {
  const c = currentCard.value
  if (!c) return []
  const rows: { key: string; type: string; name: string; item: any }[] = []
  c.weapons.forEach((w) => rows.push({ key: 'w-' + w.id, type: '武器', name: w.name || '(未命名武器)', item: w }))
  if (c.armor.kind !== 'none') rows.push({ key: 'armor', type: '护甲', name: c.armor.name || ARMOR_KIND_LABELS[c.armor.kind], item: c.armor })
  if (c.shield.equipped) rows.push({ key: 'shield', type: '盾牌', name: c.shield.name || '盾牌', item: c.shield })
  return rows
})

// 法术按环位 0-9 排序
const sortedSpells = computed(() => {
  const c = currentCard.value
  if (!c) return []
  return [...c.spells].sort((a, b) => (a.level || 0) - (b.level || 0) || a.name.localeCompare(b.name))
})

function fmtMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`
}

const statusTagType = computed(() =>
  backendStatus.value.status === 'online' ? 'success' : backendStatus.value.checking ? 'info' : 'warning'
)
const statusLabel = computed(() => {
  if (backendStatus.value.checking) return '连接检查中…'
  if (backendStatus.value.status === 'online') return '后端已连接'
  return '后端离线（使用本地存储）'
})

// ========== 卡片增删改 ==========
function addCard() {
  const card = createEmptyCard(`新角色 ${cards.value.length + 1}`)
  card.id = uid()
  cards.value.push(card)
  currentId.value = card.id
}

function duplicateCard(card: CharacterCard) {
  const copy = normalizeCharacterCard({
    ...card,
    id: uid(),
    name: card.name ? `${card.name}（副本）` : '未命名角色（副本）',
    createdAt: new Date().toISOString(),
  })
  if (!copy) return
  cards.value.push(copy)
  currentId.value = copy.id
  ElMessage.success('已复制角色卡')
}

async function deleteCard(card: CharacterCard) {
  try {
    await ElMessageBox.confirm(`确定删除角色卡「${card.name || '未命名角色'}」？此操作不可恢复。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  const idx = cards.value.findIndex((c) => c.id === card.id)
  if (idx === -1) return
  cards.value.splice(idx, 1)
  if (currentId.value === card.id) currentId.value = cards.value[0]?.id ?? ''
  ElMessage.success('已删除')
}

// ========== 生命值 ==========
function adjustHp(delta: number) {
  const c = currentCard.value
  if (!c) return
  const max = c.hp.max || 0
  c.hp.current = Math.max(0, Math.min(max, c.hp.current + delta))
}
function clampHp() {
  const c = currentCard.value
  if (!c) return
  if (c.hp.max < 0) c.hp.max = 0
  if (c.hp.current > c.hp.max) c.hp.current = c.hp.max
  if (c.hp.current < 0) c.hp.current = 0
}
function longRest() {
  const c = currentCard.value
  if (!c) return
  c.hp.current = c.hp.max
  c.tempHp = 0
  c.resources.forEach((r) => {
    r.available = r.total
  })
  ElMessage.success('长休完成，生命值与资源已恢复')
}

// 按察觉技能重新计算被动察觉
function recalcPassive() {
  const c = currentCard.value
  if (!c) return
  c.passivePerception = 10 + getSkillTotal(c, '察觉')
}

// 护甲类型切换时填入该类护甲的基础 AC
function onArmorKindChange() {
  const c = currentCard.value
  if (!c) return
  c.armor.ac = ARMOR_DEFAULT_AC[c.armor.kind]
}

// ========== 装备 / 武器 / 防具 / 法术 增删 ==========
function addWeapon() {
  currentCard.value?.weapons.push({
    id: uid(),
    name: '',
    mastery: '',
    ability: '',
    damage: '',
    damageType: '',
    traits: '',
    ammo: 0,
    cost: '',
    attuned: false,
    description: '',
    slot: '手部',
  })
}

function onSelectWeaponPreset(key: string) {
  const p = allPresetWeapons.value.find((x) => presetKey(x) === key)
  if (!p || !currentCard.value) return
  currentCard.value.weapons.push({
    id: uid(),
    name: p.name,
    mastery: p.mastery,
    ability: defaultAbilityForWeapon(p.name, p.traits),
    damage: p.damage,
    damageType: p.damageType,
    traits: p.traits,
    ammo: /弹药|装填/.test(p.traits) ? 20 : 0,
    cost: p.cost,
    attuned: false,
    description: '',
    slot: '手部',
  })
  weaponPresetSel.value = ''
}

function saveWeaponToLibrary(w: any) {
  const preset: WeaponPreset = {
    name: w.name || '自定义武器',
    mastery: w.mastery || '',
    damage: w.damage || '',
    damageType: w.damageType || '',
    cost: w.cost || '',
    traits: w.traits || '',
  }
  if (weaponLibrary.value.some((x) => presetKey(x) === presetKey(preset))) {
    ElMessage.info('该武器已在武器库中')
    return
  }
  weaponLibrary.value.push(preset)
  persistWeaponLibrary()
  ElMessage.success(`已将「${preset.name}」存入武器库`)
}
function removeWeapon(w: any) {
  const a = currentCard.value?.weapons
  if (!a) return
  const i = a.findIndex((x) => x.id === w.id)
  if (i !== -1) a.splice(i, 1)
}
function addEquipment() {
  currentCard.value?.equipment.push({ id: uid(), name: '', attuned: false, description: '', slot: '' })
}
function removeEquipment(e: any) {
  const list = currentCard.value?.equipment
  if (!list) return
  const i = list.findIndex((x) => x.id === e.id)
  if (i !== -1) list.splice(i, 1)
}

// ========== 多职业兼职 ==========
const totalLevel = computed(() => (currentCard.value ? getTotalLevel(currentCard.value) : 0))

function addClass() {
  currentCard.value?.classes.push({ id: uid(), name: '', level: 1 })
}
function removeClass(cl: any) {
  const list = currentCard.value?.classes
  if (!list) return
  const i = list.findIndex((x) => x.id === cl.id)
  if (i !== -1) list.splice(i, 1)
}
function addSpell() {
  currentCard.value?.spells.push({
    id: uid(),
    status: '已准备',
    level: 0,
    school: '',
    ritual: false,
    name: '',
    castingTime: '',
    range: '',
    duration: '',
    v: false,
    s: false,
    m: false,
    material: '',
    effect: '',
  })
}
function removeSpell(s: any) {
  const list = currentCard.value?.spells
  if (!list) return
  const i = list.findIndex((x) => x.id === s.id)
  if (i !== -1) list.splice(i, 1)
}

function openSpellDialog(sp: Spell) {
  spellEditTarget.value = sp
  spellEditDialog.value = true
}

// ========== 加入先攻骰 ==========
function sendToInitiative() {
  const c = currentCard.value
  if (!c) return
  if (!c.name.trim()) {
    ElMessage.warning('请先给角色命名！')
    return
  }
  let list: any[] = []
  try {
    const saved = localStorage.getItem('player')
    list = saved ? JSON.parse(saved) : []
    if (!Array.isArray(list)) list = []
  } catch {
    list = []
  }
  const entry = { name: c.name, bonus: getInitiativeTotal(c), advantage: c.initiativeAdvantage || 'normal' }
  const idx = list.findIndex((p: any) => p?.name === entry.name)
  if (idx >= 0) list[idx] = entry
  else list.push(entry)
  localStorage.setItem('player', JSON.stringify(list))
  ElMessage.success(`已将「${c.name}」加入先攻骰玩家列表`)
}

// ========== 导入 / 导出 ==========
function importCardsFromFile() {
  fileInput.value?.click()
}
async function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const text = await file.text()
    const data = JSON.parse(text)
    const list = Array.isArray(data) ? data : [data]
    const added = list.map(normalizeCharacterCard).filter((c): c is NormalizedCard => c !== null)
    if (!added.length) {
      ElMessage.warning('未识别到有效的角色卡数据')
      return
    }
    cards.value.push(...added)
    currentId.value = added[0].id
    ElMessage.success(`已导入 ${added.length} 张角色卡`)
  } catch (err) {
    console.error(err)
    ElMessage.error('导入失败：JSON 解析错误')
  }
}
function downloadJSON(text: string, filename: string) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
function exportCard(card: CharacterCard) {
  downloadJSON(JSON.stringify(card, null, 2), `${card.name || '角色卡'}.json`)
}
function exportAllCards() {
  downloadJSON(JSON.stringify(cards.value, null, 2), '角色卡库.json')
}

// ========== 本地持久化 ==========
function localSave() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards.value))
  localStorage.setItem(CURRENT_KEY, currentId.value)
}

// ========== 后端同步 ==========
let syncTimer: ReturnType<typeof setTimeout> | null = null
let hydrating = false

function scheduleSync() {
  if (hydrating) return
  localSave()
  if (backendStatus.value.status !== 'online') return
  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => pushToBackend(), 800)
}

async function pushToBackend(force = false) {
  // 非主动且当前离线时，先尝试重新探测连接
  if (backendStatus.value.status !== 'online') {
    if (!force) {
      backendStatus.value.status = 'offline'
      return
    }
    backendStatus.value.checking = true
    const ok = await backendPing()
    backendStatus.value.checking = false
    if (!ok) {
      backendStatus.value.status = 'offline'
      ElMessage.warning('后端离线，已保存到本地')
      return
    }
    backendStatus.value.status = 'online'
  }
  backendStatus.value.checking = true
  // 发送清洗后的数据（移除未填写的空职业行）
  const toSend = cards.value.map((c) => ({
    ...c,
    classes: (c.classes || []).filter((cl) => (cl.name && cl.name.trim()) || cl.level !== 1),
  }))
  const ok = await backendReplaceAll(toSend)
  backendStatus.value.checking = false
  if (ok) {
    backendStatus.value.status = 'online'
    backendStatus.value.lastSync = new Date().toLocaleTimeString()
    backendStatus.value.error = null
  } else {
    backendStatus.value.status = 'offline'
    backendStatus.value.error = '写入后端失败，已保留在本地'
    ElMessage.error('写入后端失败，已保留在本地')
  }
}

async function testConnection() {
  setBackendBase(backendUrlInput.value)
  backendStatus.value.checking = true
  backendStatus.value.error = null
  const ok = await backendPing()
  backendStatus.value.checking = false
  backendStatus.value.status = ok ? 'online' : 'offline'
  if (ok) {
    const remote = await backendFetchAll()
    if (remote) {
      const norm = remote.map(normalizeCharacterCard).filter((c): c is NormalizedCard => c !== null)
      if (norm.length || !cards.value.length) {
        const ids = new Set(norm.map((c) => c.id))
        // 合并：保留本地当前集合与远端并集，避免覆盖本地新增
        const merged = [...cards.value.filter((c) => !ids.has(c.id)), ...norm]
        cards.value = merged
      }
    }
    ElMessage.success('后端连接成功，已拉取数据')
  } else {
    ElMessage.warning('无法连接后端，将使用本地存储')
  }
}

function loadWeaponLibrary() {
  let lib: WeaponPreset[] = []
  const saved = localStorage.getItem(WEAPON_LIBRARY_KEY)
  if (saved) {
    try {
      const p = JSON.parse(saved)
      if (Array.isArray(p)) lib = p
    } catch {
      lib = []
    }
  }
  if (!lib.length) {
    // 迁移旧的"自定义武器库"并合并标准清单
    const old = localStorage.getItem(LEGACY_CUSTOM_WEAPONS_KEY)
    if (old) {
      try {
        const p = JSON.parse(old)
        if (Array.isArray(p)) lib = [...WEAPON_PRESETS, ...p]
      } catch {
        lib = []
      }
    }
    if (!lib.length) lib = [...WEAPON_PRESETS]
    localStorage.removeItem(LEGACY_CUSTOM_WEAPONS_KEY)
  }
  weaponLibrary.value = lib
  persistWeaponLibrary()
}

// ========== 初始化 ==========
async function init() {
  hydrating = true
  loadWeaponLibrary()
  const ok = await backendPing()
  backendStatus.value.status = ok ? 'online' : 'offline'
  if (ok) {
    const remote = await backendFetchAll()
    if (remote && remote.length) {
      cards.value = remote.map(normalizeCharacterCard).filter((c): c is NormalizedCard => c !== null)
    } else {
      loadLocal()
    }
  } else {
    loadLocal()
    backendStatus.value.error = '后端不可用，已使用本地存储'
  }
  const cur = localStorage.getItem(CURRENT_KEY)
  currentId.value = cur && cards.value.some((c) => c.id === cur) ? cur : (cards.value[0]?.id ?? '')
  maybeSeedSamples()
  hydrating = false
  localSave()
}

function loadLocal() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      cards.value = Array.isArray(parsed)
        ? parsed.map(normalizeCharacterCard).filter((c): c is NormalizedCard => c !== null)
        : []
    } catch (err) {
      console.error('读取角色卡失败', err)
      cards.value = []
    }
  }
}

// 首次为空时载入一个示例角色（只载一次，删除后不会重新出现）
function maybeSeedSamples() {
  if (cards.value.length) return
  if (localStorage.getItem(SAMPLE_SEED_FLAG)) return
  const sample = createRandomSampleCharacter()
  if (sample) {
    cards.value.push(sample)
    currentId.value = sample.id
    localStorage.setItem(SAMPLE_SEED_FLAG, '1')
    ElMessage.info(`已加入示例角色：${sample.className} ${sample.level}级`)
  }
}

// 手动随机添加一个示例角色
function addSampleCharacters() {
  const existing = new Set(cards.value.map((c) => c.id))
  const candidates = createSampleCharacters().filter((s) => !existing.has(s.id))
  if (!candidates.length) {
    ElMessage.info('示例角色已在库中')
    return
  }
  const pick = candidates[Math.floor(Math.random() * candidates.length)]
  cards.value.push(pick)
  currentId.value = pick.id
  ElMessage.success(`已添加示例角色：${pick.className} ${pick.level}级`)
}

watch(cards, scheduleSync, { deep: true })
watch(currentId, localSave)

onMounted(() => {
  init()
})
</script>

<style scoped>
.character-manager {
  padding: 8px 4px 40px;
}
.cm-header h2 {
  margin: 0 0 4px;
}
.hint {
  color: #777;
  font-size: 13px;
  margin: 4px 0 14px;
}
.cm-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.card-count {
  color: #9ca3af;
  font-size: 13px;
}

/* 后端状态条 */
.cm-backend {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  margin-bottom: 16px;
}
.cm-be-input {
  max-width: 320px;
}
.cm-sync-time {
  color: #9ca3af;
  font-size: 12px;
}

.cm-empty {
  padding: 60px 20px;
  text-align: center;
  color: #9ca3af;
  border: 2px dashed #d1d5db;
  border-radius: 12px;
}
.cm-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 16px;
  align-items: start;
}

/* 左侧列表 */
.cm-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 72vh;
  overflow-y: auto;
  padding-right: 4px;
}
.cm-card-item {
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 10px 12px;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.cm-card-item:hover {
  border-color: #c7d2fe;
}
.cm-card-item.active {
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.18);
  background: #eef2ff;
}
.cm-card-name {
  font-weight: 600;
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cm-card-meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}
.cm-card-actions {
  margin-top: 6px;
  display: flex;
  justify-content: flex-end;
}

/* 右侧详情 */
.cm-detail {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
}
.cm-detail-head {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.cm-name-input {
  max-width: 260px;
}
.cm-summary {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.cm-sum-chip {
  background: #f3f4f6;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  color: #4b5563;
}
.cm-detail-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-left: auto;
}

.cm-tabs :deep(.el-tabs__content) {
  overflow: visible;
}

.cm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}
.cm-panel {
  border: 1px solid #f3f4f6;
  border-radius: 10px;
  padding: 12px 14px;
  background: #fafafa;
}
.cm-panel h4 {
  margin: 0 0 10px;
  font-size: 14px;
}
.cm-panel-wide {
  grid-column: 1 / -1;
}
.cm-form-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.cm-form-row label {
  width: 88px;
  flex: 0 0 auto;
  font-size: 13px;
  color: #4b5563;
}
.cm-class-block {
  margin-bottom: 10px;
}
.cm-class-block-title {
  font-weight: 600;
  font-size: 13px;
  color: #4b5563;
  margin-bottom: 6px;
}
.cm-class-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.cm-class-row :deep(.el-input) {
  flex: 1;
  min-width: 130px;
}
.cm-class-row :deep(.el-input-number) {
  width: 120px;
  flex: 0 0 auto;
}
.cm-class-level :deep(.el-input__inner) {
  text-align: center;
}
.cm-class-empty {
  color: #9ca3af;
  font-size: 12px;
  margin-bottom: 6px;
}
.cm-class-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cm-class-total {
  color: #4b5563;
  font-size: 13px;
}
.cm-class-hint {
  color: #9ca3af;
  font-size: 12px;
  margin-top: 6px;
}
.cm-num {
  width: 90px;
}
.cm-num :deep(.el-input-number) {
  width: 82px;
}
.cm-static {
  font-weight: 600;
  color: #2563eb;
}
.cm-inline {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cm-inline :deep(.el-input-number) {
  width: 110px;
}
.cm-init {
  font-size: 22px;
}
.cm-formula {
  color: #9ca3af;
  font-size: 12px;
}
.cm-dice {
  display: flex;
  align-items: center;
  gap: 4px;
}
.cm-dice :deep(.el-input-number) {
  width: 76px;
}
.cm-conditions {
  display: flex;
  flex-wrap: wrap;
  gap: 0 16px;
}

/* HP */
.hp-line {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 8px;
}
.hp-current {
  font-size: 34px;
  font-weight: 700;
  line-height: 1;
}
.hp-current.danger {
  color: #dc2626;
}
.hp-max {
  font-size: 20px;
  color: #6b7280;
}
.hp-sep {
  font-size: 20px;
  color: #9ca3af;
}
.hp-temp {
  margin-left: auto;
  font-size: 13px;
  color: #0d9488;
  background: #ccfbf1;
  padding: 2px 8px;
  border-radius: 999px;
}
.hp-bar {
  height: 10px;
  border-radius: 999px;
  background: #e5e7eb;
  overflow: hidden;
  margin-bottom: 12px;
}
.hp-fill {
  height: 100%;
  background: linear-gradient(90deg, #22c55e, #16a34a);
  transition: width 0.2s;
}
.hp-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin: 10px 0;
}
.long-rest {
  width: 100%;
}

/* 通用表 */
.cm-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 8px;
}
.cm-table th,
.cm-table td {
  border: 1px solid #e5e7eb;
  padding: 4px 6px;
  text-align: left;
  font-size: 13px;
}
.cm-table th {
  background: #f3f4f6;
}
.cm-table :deep(.el-input) {
  --el-input-height: 26px;
}

/* 武器 */
.cm-weapon-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.cm-weapon-preset {
  width: 360px;
}
.cm-table-wrap {
  overflow-x: auto;
}
.cm-hit {
  text-align: center;
  font-weight: 600;
  color: #b45309;
  white-space: nowrap;
}
.cm-dmg {
  color: #4f46e5;
}
.cm-library-empty {
  color: #9ca3af;
  font-size: 13px;
  padding: 12px 0;
  text-align: center;
}
.cm-eq-name {
  font-weight: 600;
  white-space: nowrap;
}
.cm-eq-attune {
  width: 90px;
  text-align: center;
}
.cm-eq-slot {
  width: 110px;
}
.cm-eq-empty {
  color: #9ca3af;
  text-align: center;
}
.cm-vsm {
  width: 44px;
  text-align: center;
}
.cm-spell-field {
  margin-bottom: 14px;
}
.cm-spell-field label {
  display: block;
  font-size: 13px;
  color: #4b5563;
  margin-bottom: 6px;
}


/* 防具（护甲 + 盾牌） */
.cm-ac-summary {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 8px 10px;
  background: #eef2ff;
  border-radius: 8px;
  margin-bottom: 12px;
}
.cm-ac-sum-label {
  font-size: 13px;
  color: #4b5563;
}
.cm-ac-total {
  font-size: 24px;
  color: #4f46e5;
}
.cm-def {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
  background: #fff;
}
.cm-def-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.cm-def-equip {
  margin-left: auto;
}
.cm-def-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.cm-def-label {
  width: 72px;
  flex: 0 0 auto;
  font-size: 13px;
  color: #4b5563;
}
.cm-def-row :deep(.el-input) {
  flex: 1;
}

@media (max-width: 860px) {
  .cm-layout {
    grid-template-columns: 1fr;
  }
  .cm-list {
    max-height: 260px;
  }
}
</style>
