# DnD 工具箱 — 后端 API 契约

> 给 Laravel 后端实现的权威接口文档。前端已按本契约接线（未上线前用 `localStorage` 兜底；后端可用后自动切长连接）。
> 基础地址：`http://localhost:12226/api`（线上 `http://106.12.131.21/api`）。

## 通用约定
- 返回 `application/json; charset=utf-8`；中文用 `JSON_UNESCAPED_UNICODE`。
- 成功：`{"ok":true, ...}`；失败：`{"ok":false,"error":"..."}`（400/500）。
- 前端会先 `GET /ping` 判断在线。
- CORS（跨域直连）：`allowed_origins => ['*']`、`methods => ['GET','POST','PUT','PATCH','DELETE','OPTIONS']`、`headers => ['Content-Type','Accept']`；`options` 处理预检。开发时前端 `/api` 走 Vite 代理到 12226，无需 CORS。
- **Reverb**：前端 `laravel-echo`（`broadcaster:'reverb'`），订阅 `presence-combat.{sessionId}`；广播接入 `config/broadcasting.php` 与 `routes/channels.php`。

---

## 1. 连通检测
| 方法 | 路径 | 返回 |
|---|---|---|
| GET | `/api/ping` | `{"ok":true}` |

## 2. 角色卡库（整体存取，不透明）
| 方法 | 路径 | 请求体 | 返回 |
|---|---|---|---|
| GET | `/api/characters` | — | `{"ok":true,"data":[<CharacterCard>...]}` |
| POST | `/api/characters/sync` | `{"data":[<CharacterCard>...]}` | `{"ok":true,"count":N}` |
| PATCH | `/api/characters/{id}` | `{"data":{<顶层字段子集>}}` | `{"ok":true}` |

**CharacterCard**：不透明 JSON（id/name/能力/HP/武器/技能/法术…），后端存 `payload`(json)+`id`/`name`/`updated_at`。`sync` 覆盖式（事务内清空再写）。

**分块增量（减小单次数据量）**：前端按"编辑选项卡"把卡的**顶层字段**分组，只提交发生变化的块：
- `PATCH /api/characters/{id}` 的 `data` 为整卡顶层字段的子集；后端把它**浅合并**进 `payload`（数组/对象整块替换），卡结构不变，`GET /characters` 仍返回整卡。
- id 不存在返回 404（前端自动整库 `sync` 补建一次后重试）。

| 块 | CharacterCard 顶层字段 |
|---|---|
| `basic` 基础/属性 | name, playerName, race, background, alignment, classes, xp, proficiencyBonus, portraitUrl |
| `combat` 战斗/资源 | hp, tempHp, hitDice, acBonus, initiativeBonus, initiativeAdvantage, speed, size, resistances, immunities, passivePerception, conditions, resources |
| `skills` 技能 | skills, weaponsProficient, armorProficient, languages, tools |
| `equipment` 武器/防具 | weapons, equipment, armor, shield |
| `features` 特性/专长 | classFeatures, racialFeatures, feats, specialAbilities |
| `spells` 法术 | spellAbility, spellDc, spellAttackBonus, spellSlots, spells |
| `wealth` 财富/备注 | money, weightCapacity, note |

> 合并建议：`$payload = array_merge($payload, $data)` 后写回（顶层浅合并即可）；若需要并发安全可对行加锁（lockForUpdate）。前端在探测到该端点失败时自动回退整库 `sync`，因此**新旧后端都兼容**。

## 3. 团（Party）
| 方法 | 路径 | 请求体 | 返回 |
|---|---|---|---|
| GET | `/api/parties` | — | `{"ok":true,"data":[<Party>...]}` |
| POST | `/api/parties/sync` | `{"data":[<Party>...]}` | `{"ok":true,"count":N}` |

**Party**：
```jsonc
{ "id":"...", "name":"团 1", "member_ids":["卡片id1","卡片id2"], "dm_user_id":"...", "created_at":"iso","updated_at":"iso" }
```
> 每个角色只能属于一个团（前端保证）。**团 id = 战斗会话 id**。

## 4. 先攻结果（全局共享一份）
| 方法 | 路径 | 请求体 | 返回 |
|---|---|---|---|
| GET | `/api/initiative` | — | `{"ok":true,"data":[<InitiativeRow>...],"updatedAt":"iso"}` |
| POST | `/api/initiative` | `{"data":[<InitiativeRow>...]}` | `{"ok":true}` |

**InitiativeRow**：`{ "id":3,"type":"玩家","name":"瓦肯","base":17,"bonus":2,"advantageNum":0,"advantageText":"普通","total":19 }`

## 5. 地图（战场，全局共享）— 兼容保留
| 方法 | 路径 | 请求体 | 返回 |
|---|---|---|---|
| GET | `/api/map` | — | `{"ok":true,"data":{"tokens":[...],"indicators":[...],"npcs":[...],"updatedAt":"iso"}}` |
| POST | `/api/map` | `{"data":{"tokens":[...],"indicators":[...],"npcs":[...]}}` | `{"ok":true}` |

**MapToken** `{"id":1,"name":"葛罗格","color":"#ef4444","q":3,"r":-1,"diameter":2}`；**体型占格** 微型0.5/小中1/大2/巨3/超巨4（1 格=5 尺）。
> 说明：战斗会话已是主流程，此 `/map` 仅在非会话的"自由地图"使用，**可保留兼容**。

---

## 6. 战斗会话（核心，配合 Reverb）
> **团 id = 会话 id**。选团即"创建/加入"该会话。前端会**把角色类参战者自动对账到团成员**（首次带入全团，之后读取上次并按团成员增/删，保留怪物与已有位置）。支持**锁定**（锁定时禁增删/移动）。

| 方法 | 路径 | 请求体 | 返回 |
|---|---|---|---|
| POST | `/api/combat-sessions` | `{"party_id":"...","dm_user_id":"..."}` | `{"ok":true,"data":{<CombatSession>}}` |
| GET | `/api/combat-sessions/{id}` | — | `{"ok":true,"data":{<CombatSession快照>}}` |
| POST | `/api/combat-sessions/{id}/combatants/sync` | `{"combatants":[<Combatant>...]}` | `{"ok":true,"count":N}`（对账替换角色类，保留怪物） |
| POST | `/api/combat-sessions/{id}/combatants` | `{...Combatant}` | `{"ok":true,"data":{Combatant}}` |
| PATCH | `/api/combatants/{id}` | `{q?,r?,hp?,order?,initiative_roll?,initiative_total?,advantage?,color?,name?,size?,ac?}` | `{"ok":true}` |
| DELETE | `/api/combatants/{id}` | — | `{"ok":true}` |
| POST | `/api/combatants/{id}/swap` | `{"other_id":"..."}` | `{"ok":true}`（互换 order） |
| POST | `/api/combat-sessions/{id}/roll-initiative` | — | `{"ok":true,"data":{"order":[{"combatant_id","order","initiative_total"}]}}` |
| POST | `/api/combat-sessions/{id}/lock` | `{"locked":true}` | `{"ok":true}` |
| POST | `/api/combat-sessions/{id}/spell-areas` | `{...SpellArea}` | `{"ok":true,"data":{SpellArea}}` |
| PATCH | `/api/spell-areas/{id}` | 同 SpellArea | `{"ok":true}` |
| DELETE | `/api/spell-areas/{id}` | — | `{"ok":true}` |
| POST | `/api/combat-sessions/{id}/turn` | — | `{"ok":true,"data":{current_combatant_id, round}}` |

**CombatSession 快照**：
```jsonc
{ "id":"团id","party_id":"团id","dm_user_id":"...",
  "state":"setup|initiative|combat|ended","locked":false,
  "current_combatant_id":"...","round":1,
  "combatants":[ <Combatant>... ], "spell_areas":[ <SpellArea>... ] }
```

**Combatant**（参战者 = 角色或怪物）：
```jsonc
{ "id":"c1","type":"character|monster","ref_id":"角色卡id或空",
  "name":"构装骑士","color":"#ef4444","size":2,
  "q":3,"r":-1,
  "order":1,"initiative_roll":17,"initiative_bonus":5,"initiative_total":22,
  "advantage":"normal|advantage|disadvantage",
  "ac":18,"hp":{"current":190,"max":201},
  "controlled_by":"玩家id或dm","payload":{ ...怪物卡/角色卡完整信息(可选) } }
```
- **`ref_id`**：角色类必填（= 角色卡 id），用于**去重**（同一角色卡只入一次）。
- `initiative_total = initiative_roll + initiative_bonus + 优劣值(±5) + 装备修正`。
- **攻击/释放的怪物**：`payload` 记录怪物卡完整信息（属性/技能/动作/反应/免疫…，第一版只存不展示，供图鉴）。

> **载荷上限**：Reverb/Pusher 单条消息约 10KB。快照/事件会整体广播，**参战者 payload 务必精简**
> （角色卡完整数据在 `characters` 表，前端已通过 `ref_id` 关联，不重复写入 combatant.payload；角色 payload 一律传 null）。
> 怪物 payload 为将来图鉴预留，请控制单卡 < ~6KB，避免多人同会时快照超限。

> **并发去重**：`combatants/sync` 按 `ref_id` 对账。两人几乎同时为同一团建会并 sync 时，
> 两个事务互不可见可能各插入一行（同 ref_id 双份）。建议对 `combatants(session_id, ref_id)` 加唯一索引
> （`type='character'` 且 `ref_id` 非空时生效），并在 sync/store 事务内对行加锁（`lockForUpdate`）规避。

**SpellArea**（法术区域）：
```jsonc
{ "id":"...","type":"cone|circle","q":3,"r":-1,"angle":0.6,"ft":30,"bound_to":"c1" }
```
- `bound_to`：绑定某个 Combatant id，**跟随其移动**；（q,r 为初始，绑定后以绑定者坐标为准）。

---

## 7. Reverb 实时事件
- 频道：`presence-combat.{sessionId}`（可在线成员：DM+玩家）。
- 前端 `laravel-echo` 监听 `.EventName`（`private`/`presence` 前缀事件）。

| 事件 | 载荷 | 触发 |
|---|---|---|
| `CombatSessionState` | 会话快照 | 进频道/建会/加入 |
| `CombatantAdded` | `{ combatant }` | 新增参战者 |
| `CombatantUpdated` | `{ combatant }` | 位置/HP/先攻/次序/颜色改 |
| `CombatantRemoved` | `{ combatant_id }` | 移除参战者 |
| `InitiativeRolled` | `{ order:[{combatant_id,order,initiative_total}] }` | 掷先攻 |
| `CombatantSwapped` | `{ a_id, b_id }` | 换位 |
| `SpellAreaUpdated` | `{ spell_area }` | 放/改/删法术区 |
| `TurnChanged` | `{ current_combatant_id, round }` | 切回合 |
| `SessionLocked` | `{ locked }` | 锁定/解锁 |

> 权威态在服务端；客户端收到事件只更新本地渲染，不轮询。

---

## 8. 建议表结构（Laravel）
- `characters`：`id(string PK), name, payload(json), updated_at`
- `parties`：`id(string PK), name, dm_user_id, payload(json), updated_at`
- `initiative_results`：单行 `payload(json), updated_at`
- `map_state`：单行 `payload(json){tokens,indicators,npcs}, updated_at`
- `combat_sessions`：`id(string PK, =party_id), party_id, dm_user_id, state, locked(bool), current_combatant_id, round, updated_at`
- `combatants`：`id(string PK), session_id, type, ref_id, name, color, size, q, r, ord, initiative_roll, initiative_bonus, initiative_total, advantage, ac, hp(payload/json), controlled_by, payload(json), updated_at`
- `spell_areas`：`id(string PK), session_id, type, q, r, angle, ft, bound_to, updated_at`

## 9. 建议实现顺序
1. Reverb 安装/配置 + `Broadcast::routes()`。
2. 迁移：`characters/parties/combat_sessions/combatants/spell_areas`。
3. 会话 CRUD + 快照接口 + `combatants/sync`（对账）。
4. 广播事件（写入后 `broadcast()`）。
5. `roll-initiative` / `swap` / `turn` / `lock` / `spell-areas`。
6. Echo 鉴权（`presence` + `Authorization`），前端直连联测。
