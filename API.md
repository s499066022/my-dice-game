# DnD 工具箱 — API 契约（最终版）

> **实现状态**：本文档所有端点/事件/表均已在前端接线，后端（Laravel + Reverb，repo `s499066022/chain`）
> 已实现并通过双浏览器/双设备联测；**部署到服务器前需拉取 chain 最新 main**。
> 前端仓库：`s499066022/my-dice-game`（Vue3 + Vite + Element Plus）。

- 本地后端：`http://localhost:12226/api`（Docker：nginx 反代 php-fpm，WS 经 `/app` 反代到 php 容器 Reverb 8080）
- 线上后端：`http://106.12.131.21:12226/api`（nginx 同构）
- 所有 JSON 中文使用 `JSON_UNESCAPED_UNICODE`；请求/响应一律 UTF-8。

---

## 0. 通用约定

- 成功 `{"ok":true, ...}`；失败 `{"ok":false,"error":"..."}`，HTTP 400/403/404/500 对应语义。
- **CORS**（跨域直连）：`allowed_methods = GET,POST,PUT,PATCH,DELETE,OPTIONS`；
  `allowed_headers = Content-Type, Accept, Authorization, X-Dnd-User`；`allowed_origins = ['*']`（已含 localhost:5173）。
  开发时前端 `/api` 走 Vite 代理，同源无 CORS。
- **鉴权/成员标识（v1 无账号体系）**：Reverb 频道鉴权 `POST {base}/broadcasting/auth`
  body `{socket_id, channel_name}`；可带 `X-Dnd-User` 请求头区分 presence 成员（缺省 `guest`）。
  返回 `{auth:"appKey:hmac", channel_data}`。
- **写入类资源多数为“整体/块合并”**：见各节。多人同时整库覆盖有互相覆盖风险，前端已做“拉取合并后回写”；
  强烈建议生产环境给关键表加行锁/唯一索引（见 §8 注）。
- 时间戳一律 ISO8601 字符串（`updatedAt/created_at/updated_at`）。

---

## 1. 连通检测

| 方法 | 路径 | 返回 |
|---|---|---|
| GET | `/api/ping` | `{"ok":true}` |

---

## 2. 角色卡库（v2：轻量列表 + 分块 + 法术独立分页）

> 设计目标：卡多/法术多时不整卡整传。列表、团、地图、先攻只使用 **LightCard**（名字+战斗核心）；
> 编辑其它选项卡按需加载块；法术是独立表分页 CRUD。

| 方法 | 路径 | 请求体 | 返回/说明 |
|---|---|---|---|
| GET | `/api/characters/light` | — | `{"ok":true,"data":[<LightCard>...]}`（按 name 排序） |
| GET | `/api/characters/{id}/blocks/{block}` | — | `{"ok":true,"data":{该块顶层字段}}`（404=卡不存在 / 400=未知块） |
| PATCH | `/api/characters/{id}/blocks/{block}` | `{"data":{...}}` | 顶层**浅合并**进 payload（行锁），成功广播 `CharacterCardUpdated`；404=卡不存在 |
| DELETE | `/api/characters/{id}` | — | 删除卡 + 连带删除 `character_spells`，广播 `CharacterCardRemoved` |
| GET | `/api/characters` | — | 整卡列表（导出/迁移/兼容保留） |
| POST | `/api/characters/sync` | `{"data":[<CharacterCard>...]}` | **整库覆盖**（事务清空重写；自动把 payload.spells 抽到 character_spells）→ 仅导入/迁移/兜底用 |

**LightCard**（= combat 块字段 + 元数据；含 AC 三要素与 abilities，客户端据此可算 AC/先攻）：
```jsonc
{ "id":"...", "name":"葛罗格",
  "hp":{"current":87,"max":115}, "tempHp":0,
  "hitDice":{"current":11,"max":11,"formula":"1d12"},
  "acBonus":0, "armor":{...}, "shield":{...},
  "initiativeBonus":2, "initiativeAdvantage":"normal",
  "abilities":{"str":{...},"dex":{...},"con":{...},"int":{...},"wis":{...},"cha":{...}},
  "speed":"30 尺","size":"中型",
  "resistances":"", "immunities":"", "conditions":[], "passivePerception":15,
  "resources":[<CardResource>...], "updatedAt":"iso" }
```

**分块字段表**（`block` ∈ 下表；GET 只返回存在的键）：
| block | CharacterCard 顶层字段 |
|---|---|
| `combat` | hp, tempHp, hitDice, acBonus, armor, shield, initiativeBonus, initiativeAdvantage, abilities, speed, size, resistances, immunities, conditions, passivePerception, resources |
| `basic` | playerName, race, background, alignment, classes, xp, proficiencyBonus, portraitUrl |
| `skills` | skills, weaponsProficient, armorProficient, languages, tools |
| `equipment` | weapons, equipment（护甲/盾牌在 combat 块） |
| `features` | classFeatures, racialFeatures, feats, specialAbilities |
| `spellconfig` | spellAbility, spellDc, spellAttackBonus, spellSlots |
| `wealth` | money, weightCapacity, note |

> - 浅合并 = `$payload = array_merge($payload, $data)`（数组/对象整块替换）；建议行锁（实现已 lockForUpdate）。
> - `name` 随 light/整卡返回；改名字段随 `combat` 块 PATCH 一起传即可（merge 不做块白名单过滤）。
> - 新建卡（本地有、远端无）→ PATCH 404 → 前端自动整库 `sync` 补建一次再重试。

### 2.1 法术（独立表 character_spells，分页 CRUD）

| 方法 | 路径 | 请求体/参数 | 返回/说明 |
|---|---|---|---|
| GET | `/api/characters/{id}/spells` | `?page=1&per_page=20&q=<名/学派/效果>&level=<0-9>` | `{"ok":true,"data":{"items":[<Spell>],"total":N,"page":P,"per_page":S}}`；排序 level 升序→name 升序 |
| POST | `/api/characters/{id}/spells` | `<Spell>` | `{"ok":true,"data":<Spell>}`；缺 id 自动生成；广播 `SpellUpdated` |
| PATCH | `/api/spells/{id}` | `<Spell 字段子集>` | 浅合并进 payload；广播 `SpellUpdated` |
| DELETE | `/api/spells/{id}` | — | 广播 `SpellUpdated`（spell 带 `deleted:true`） |

**Spell**（不透明 JSON）：`{id, status, level(0-9), school, ritual, name, castingTime, range, duration, v, s, m, material, effect, description, ...}`。
> 法术库（内置 543 条 + 自定义）是**前端本地功能**，不占后端存储；选中后经上述 POST 以副本入库到该角色。

### 2.2 角色卡实时频道（presence-characters）

| 事件 | 载荷 | 触发 |
|---|---|---|
| `CharacterCardUpdated` | `{id, block, data:{...}}` | 任意块 PATCH 成功 |
| `CharacterCardRemoved` | `{id}` | DELETE 角色卡 |
| `SpellUpdated` | `{card_id, spell}`（删除时 spell.deleted=true） | 法术增/改/删 |

---

## 3. 团（Party）

| 方法 | 路径 | 请求体 | 返回/说明 |
|---|---|---|---|
| GET | `/api/parties` | — | `{"ok":true,"data":[<Party>...]}`（updated_at 倒序） |
| POST | `/api/parties/sync` | `{"data":[<Party>...]}` | **整库覆盖**（事务清空重写）；成功后广播 `PartiesChanged`（presence-parties）→ `{"ok":true,"count":N}` |

**Party**：`{"id":"...","name":"团 1","dm_user_id":"...","member_ids":["卡id"...],"created_at","updated_at"}`
（payload 原样存储；member 键名兼容 `member_ids` / `memberIds`）。
> **团 id = 战斗会话 id**。团数据低变更，实时用「整库广播 + 各端整体刷新」即可；删除/改名也会随全量广播扩散。
> 实时频道：**presence-parties**，事件 `PartiesChanged` 载荷 `{parties:[<Party>...]}`。

---

## 4. 先攻结果（全局共享一份，兼容保留）

| 方法 | 路径 | 请求体 | 返回 |
|---|---|---|---|
| GET | `/api/initiative` | — | `{"ok":true,"data":[<InitiativeRow>...],"updatedAt":"iso"}` |
| POST | `/api/initiative` | `{"data":[<InitiativeRow>...]}` | `{"ok":true}` |

**InitiativeRow**：`{"id":3,"type":"玩家","name":"瓦肯","base":17,"bonus":2,"advantageNum":0,"advantageText":"普通","total":19}`

---

## 5. 地图（自由地图，兼容保留，不再被主流程使用）

| 方法 | 路径 | 请求体 | 返回 |
|---|---|---|---|
| GET | `/api/map` | — | `{"ok":true,"data":{"tokens":[...],"indicators":[...],"npcs":[...],"updatedAt":"iso"}}` |
| POST | `/api/map` | `{"data":{"tokens":[...],"indicators":[...],"npcs":[...]}}` | `{"ok":true}` |

> 前端主流程已完全走战斗会话长连接，此接口仅遗留兼容。已知问题：空表时 GET 可能 500（待后端补兜底，不影响会话）。

---

## 6. 战斗会话（核心：团 id = 会话 id）

| 方法 | 路径 | 请求体 | 返回/说明 |
|---|---|---|---|
| POST | `/api/combat-sessions` | `{"party_id":"...","dm_user_id":"..."}` | 幂等建会（id=party_id）；广播 `CombatSessionState` |
| GET | `/api/combat-sessions/{id}` | — | 快照；不存在自动建会 |
| POST | `/api/combat-sessions/{id}/combatants/sync` | `{"combatants":[<Combatant>...]}` | **对账**：按 ref_id 增/改角色类、删除不在名单的角色类、保留怪物；广播全量快照 |
| POST | `/api/combat-sessions/{id}/combatants` | `<Combatant>` | 新增参战者；同 ref_id 防重复（403/400）；锁定时 403；广播 `CombatantAdded` |
| PATCH | `/api/combatants/{id}` | `{q?,r?,hp?,order?,initiative_roll?,initiative_total?,advantage?,color?,name?,size?,ac?}` | 锁定时禁移动/换位(403)；广播 `CombatantUpdated` |
| DELETE | `/api/combatants/{id}` | — | 锁定时 403；广播 `CombatantRemoved` |
| POST | `/api/combatants/{id}/swap` | `{"other_id":"..."}` | 互换 order；广播 `CombatantSwapped` |
| POST | `/api/combat-sessions/{id}/roll-initiative` | — | d20+加值+优劣(±5) 排序重编 order；广播 `InitiativeRolled`；锁定 403 |
| POST | `/api/combat-sessions/{id}/lock` | `{"locked":true\|false}` | 广播 `SessionLocked` |
| POST | `/api/combat-sessions/{id}/turn` | — | 下一个行动者；到尾 round+1；广播 `TurnChanged` |
| POST | `/api/combat-sessions/{id}/spell-areas` | `<SpellArea>` | 新增区域；广播 `SpellAreaUpdated` |
| PATCH | `/api/spell-areas/{id}` | `<SpellArea 子集>` | 改（含绑定点）；广播 `SpellAreaUpdated` |
| DELETE | `/api/spell-areas/{id}` | — | 广播 `SpellAreaUpdated`（deleted:true） |

**CombatSession 快照**：
```jsonc
{ "id":"团id","party_id":"团id","dm_user_id":"...", "state":"setup|initiative|combat|ended",
  "locked":false, "current_combatant_id":"...","round":1,
  "combatants":[<Combatant>...], "spell_areas":[<SpellArea>...] }
```

**Combatant**：
```jsonc
{ "id":"c1","type":"character|monster","ref_id":"角色卡id或null",
  "name":"葛罗格","color":"#ef4444","size":2,"q":3,"r":-1,
  "order":1,"initiative_roll":17,"initiative_bonus":2,"initiative_total":22,
  "advantage":"normal|advantage|disadvantage","ac":15,"hp":{"current":87,"max":115},
  "controlled_by":"...","payload":null|{...} }
```
- 角色类 `ref_id` 必填用于去重；`initiative_total = initiative_roll + initiative_bonus + 优劣(±5)`。
- **载荷上限**：Reverb 单条约 10KB。角色类 payload 一律 null（完整卡经 ref_id 关联 characters）；
  怪物 payload 供将来图鉴，控制 < ~6KB。
- **并发去重建议**：`combatants(session_id, ref_id)` 唯一索引 + sync/store 事务行锁（当前未加索引，极端并发下可能重复，可加）。

**SpellArea**：`{"id":"...","type":"cone|circle|rect","q":3,"r":-1,"angle":0.6,"ft":30,"width_ft":null,"height_ft":null,"bound_to":"c1"}`（bound_to 跟随移动）。
`rect` 由用户三点生成（角、方向/长度、宽度）：服务端存 **wx/wy(世界坐标中心, 浮点)** + width_ft×height_ft(尺) + angle，矩形一条边严格落在前两点上；q/r 仅作兼容展示。

---

## 7. Reverb 实时事件（总表）

频道均 presence；前端 `laravel-echo` 以 `.EventName` 监听（事件裸名，载荷在 `e.data`）。

| 频道 | 事件 | 载荷 |
|---|---|---|
| `presence-characters` | `CharacterCardUpdated` | `{id, block, data}` |
| `presence-characters` | `CharacterCardRemoved` | `{id}` |
| `presence-characters` | `SpellUpdated` | `{card_id, spell}`（删除 spell.deleted=true） |
| `presence-parties` | `PartiesChanged` | `{parties:[...]}` |
| `presence-combat.{sessionId}` | `CombatSessionState` | 会话快照 |
| `presence-combat.{sessionId}` | `CombatantAdded` | `{combatant}` |
| `presence-combat.{sessionId}` | `CombatantUpdated` | `{combatant}` |
| `presence-combat.{sessionId}` | `CombatantRemoved` | `{combatant_id}` |
| `presence-combat.{sessionId}` | `InitiativeRolled` | `{order:[{combatant_id,order,initiative_total}]}` |
| `presence-combat.{sessionId}` | `CombatantSwapped` | `{a_id,b_id}` |
| `presence-combat.{sessionId}` | `SpellAreaUpdated` | `{spell_area}`（删除带 deleted） |
| `presence-combat.{sessionId}` | `TurnChanged` | `{current_combatant_id, round}` |
| `presence-combat.{sessionId}` | `SessionLocked` | `{locked}` |

> 权威态在服务端；客户端收到事件只更新本地渲染，不轮询。前端所有写入成功后在日志面板可见“发送/接收”闭环。

---

## 8. 表结构（Laravel 实际）

- `characters`：`id(string PK), name, payload(json: LightCard+各块, 不含 spells), updated_at`
- `character_spells`：`id(string PK), character_id, payload(json: Spell), created_at, updated_at`（建议索引 character_id, level）
- `parties`：`id(string PK), name, dm_user_id, payload(json), updated_at`
- `initiative_results`：单行 payload(json)
- `map_state`：单行 payload(json){tokens,indicators,npcs}
- `combat_sessions`：`id(string PK,=party_id), party_id, dm_user_id, state, locked(bool), current_combatant_id, round, updated_at`
- `combatants`：`id(string PK), session_id, type, ref_id, name, color, size, q, r, ord, initiative_roll, initiative_bonus, initiative_total, advantage, ac, hp(json), controlled_by, payload(json), updated_at`
- `spell_areas`：`id(string PK), session_id, type, q, r, angle, ft, bound_to, updated_at`

> 迁移（历史）说明：旧版本把法术内嵌 `characters.payload.spells`；`characters/sync` 现在会自动 `splitSpells` 抽到 `character_spells` 并把 payload.spells 置空，无需手工脚本。

---

## 9. 部署与注意事项

1. 后端部署：拉取 `chain` main 后执行迁移（已含 character_spells）并启动 Reverb（`php artisan reverb:start`，容器内 `--host=0.0.0.0 --port=8080`，nginx `/app` 反代）。
2. CORS 需包含 PATCH/DELETE 与 `X-Dnd-User`（config/cors.php 已更新）。
3. Reverb/Pusher 消息约 10KB 上限：payload 精简 + 分块同步即为此设计。
4. `characters/sync`、`parties/sync` 为整库覆盖：仅供迁移/导入/离线兜底；日常编辑走块/单条接口。多人协作前建议先拉后改（前端已自动拉取合并）。
5. 本地联调速查：
```bash
curl http://localhost:12226/api/ping
curl http://localhost:12226/api/characters/light
curl -X PATCH http://localhost:12226/api/characters/{id}/blocks/combat -H 'Content-Type: application/json' \
     -d '{"data":{"hp":{"current":90,"max":115}}}'
curl "http://localhost:12226/api/characters/{id}/spells?page=1&per_page=20&level=3&q=火球"
```

## 10. 遗留接口与共存注意事项（审计结论）

| 接口 | 状态 | 冲突点与处置 |
|---|---|---|
| GET/POST `/characters`、`/characters/sync` | 兼容保留（导出/迁移/离线兜底） | **与块级 PATCH 并存时可能互相覆盖**：sync 是整库 delete+insert。前端已做“块级安全合并”（以服务端整卡为底，仅用本地**已加载块**覆盖，其余块保留服务端），并把 sync 限制在迁移/导入/本地较新时。仍属 last-write-wins：请勿多个设备同时整卡同步。 |
| `characters/sync` 无广播 | 已知边界 | 整库覆盖后其它在线端不会实时刷新（无事件）。日常编辑请走 blocks/spells；确需整卡同步后，其它端刷新或等下次块广播。 |
| 旧 `payload.spells` 与新 `character_spells` | 双轨 | `sync` 会幂等抽离：该卡已有法术行则只清空 payload.spells；无行则按 id/生成 id 插入。老数据建议在任一设备点一次“整卡同步”完成抽离。 |
| DELETE `/characters/{id}` | v2 | 连带删 character_spells；**不级联**清理 party.member_ids——团里会留下失效 id，地图对账会按 ref_id 自动忽略，团页显示时前端跳过。 |
| `/map`、`/initiative` | 兼容保留 | 地图主流程已不用 `/map`；`/initiative` 仍被先攻骰页(暂不维护)使用，与战斗会话内“行动顺序”是两套独立数据，无表冲突。 |
| 路由顺序 | 无冲突 | `/characters/sync|light` 等字面段均先于 `{id}` 变段注册；无捕获歧义。 |

> 关键约定：**日常编辑走块/单条接口；整库 `sync` 只用于迁移/导入/兜底**（前端已限制触发场景）。
