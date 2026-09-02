# DnD 工具箱 — 后端接口文档

基础地址：`http://localhost:12226/api`（线上 `http://106.12.131.21/api`）

通用约定：

- 返回 `application/json; charset=utf-8`。
- 用 `ok` 表达成功与否：`{"ok":true}` 或 `{"ok":false,"error":"..."}`。
- 失败返回 400/500；中文用 `JSON_UNESCAPED_UNICODE`。
- 前端会先 `GET /ping` 判断后端是否在线。
- CORS（跨域直连时）：`allowed_origins => ['*']`、`allowed_methods => ['GET','POST','OPTIONS']`、`allowed_headers => ['Content-Type','Accept']`。开发时前端 `/api` 走 Vite 代理到 12226，无需 CORS。

---

## 1. 连通检测

| 方法 | 路径 | 返回 |
|---|---|---|
| GET | `/api/ping` | `{"ok":true}` |

---

## 2. 角色卡库（整体存取，后端不解析结构）

| 方法 | 路径 | 请求体 | 返回 |
|---|---|---|---|
| GET | `/api/characters` | — | `{"ok":true,"data":[<CharacterCard>...]}` |
| POST | `/api/characters/sync` | `{"data":[<CharacterCard>...]}` | `{"ok":true,"count":N}` |

`sync` 覆盖式：事务内清空后逐条写入。

**CharacterCard**（不透明 JSON，存 `payload` + `id`/`name`/`updated_at`）：
```jsonc
{ "id":"...", "name":"葛罗格", "playerName":"", "race":"半兽人", "className":"野蛮人", "level":11,
  "classes":[{"id":"...","name":"野蛮人","level":11}], "proficiencyBonus":4, "xp":68500,
  "abilities":{ "str":{"base":15,"background":2,"asi":2,"feat":1,"item":0,"replacement":null,"saveProficient":true} },
  "hp":{"current":87,"max":115}, "tempHp":0, "hitDice":{"current":11,"max":11,"formula":"1d12"},
  "acBonus":5, "armor":{"kind":"none","name":"无甲（无甲防御）","ac":10,"stealthDisadvantage":false,"attuned":false,"description":"","slot":"胸部"},
  "shield":{"equipped":false,"name":"","ac":0,"stealthDisadvantage":false,"attuned":false,"description":"","slot":"手部"},
  "initiativeBonus":0, "initiativeAdvantage":"normal", "speed":"40 尺", "size":"中型",
  "resistances":"钝击/穿刺/挥砍(狂暴)", "immunities":"", "passivePerception":14, "conditions":[],
  "resources":[{"id":"...","name":"狂暴次数","available":4,"total":4}],
  "weapons":[...], "equipment":[...],
  "skills":{"运动":{"proficient":1},"察觉":{"proficient":1}},
  "weaponsProficient":"简易、军用武器","armorProficient":"轻甲、中甲、盾牌","languages":"通用语、兽人语","tools":"铁匠工具",
  "classFeatures":[{"id":"...","level":1,"name":"狂暴","description":"..."}],
  "racialFeatures":[...], "feats":[...], "specialAbilities":[...],
  "spellAbility":"", "spellDc":0, "spellAttackBonus":0, "spellSlots":[...], "spells":[...],
  "money":{"pp":0,"gp":140,"sp":0,"cp":0}, "weightCapacity":300, "note":"",
  "createdAt":"iso","updatedAt":"iso" }
```

---

## 3. 团（Party，成员关系同步）

| 方法 | 路径 | 请求体 | 返回 |
|---|---|---|---|
| GET | `/api/parties` | — | `{"ok":true,"data":[<Party>...]}` |
| POST | `/api/parties/sync` | `{"data":[<Party>...]}` | `{"ok":true,"count":N}` |

**Party**：
```jsonc
{ "id":"...", "name":"团 1", "memberIds":["卡片id1","卡片id2"], "createdAt":"iso", "updatedAt":"iso" }
```
每个角色只能在某一个团中（前端保证）。

---

## 4. 先攻结果（全局共享一份）

| 方法 | 路径 | 请求体 | 返回 |
|---|---|---|---|
| GET | `/api/initiative` | — | `{"ok":true,"data":[<InitiativeRow>...],"updatedAt":"iso"}` |
| POST | `/api/initiative` | `{"data":[<InitiativeRow>...]}` | `{"ok":true}` |

**InitiativeRow**：
```jsonc
{ "id":3, "type":"玩家", "name":"瓦肯", "base":17, "bonus":2, "advantageNum":0, "advantageText":"普通", "total":19 }
```

---

## 5. 地图（战场，全局共享）

| 方法 | 路径 | 请求体 | 返回 |
|---|---|---|---|
| GET | `/api/map` | — | `{"ok":true,"data":{"tokens":[...],"indicators":[...],"npcs":[...],"updatedAt":"iso"}}` |
| POST | `/api/map` | `{"data":{"tokens":[...],"indicators":[...],"npcs":[...]}}` | `{"ok":true}` |

**MapToken**（角色/怪物位置，对象不透明）：
```jsonc
{ "id":1, "name":"葛罗格", "color":"#ef4444", "q":3, "r":-1, "diameter":2 }
```
- `q,r`：六边形轴向坐标（无限网格，固定坐标系）。
- `diameter`（占格）：微型0.5 / 小型1 / 中型1 / 大型2 / 巨型3 / 超巨型4（1 格 = 5 尺）。

**Indicator**（锥形/圆形，可绑定角色跟随）：
```jsonc
{ "id":88, "type":"cone", "q":3, "r":-1, "angle":0.6, "ft":30, "boundTo":1 }
```
- `type`：`cone` | `circle`；`angle` 只对锥形有意义（弧度）；`boundTo` 绑定某个 MapToken 的 `id`，跟随移动。

**Npc**（怪物/NPC 库，全局共享）：
```jsonc
{ "id":"...", "name":"哥布林", "type":"怪物", "color":"#ef4444", "size":1 }
```
- `size`（占格）同 MapToken 的 `diameter` 语义。

### 体型 → 占格（1 六边形 = 5 尺）
| 体型 | 占据空间 | 占格 |
|---|---|---|
| 微型 | 2.5×2.5 尺 | 0.5 |
| 小型 | 5×5 尺 | 1 |
| 中型 | 5×5 尺 | 1 |
| 大型 | 10×10 尺 | 2 |
| 巨型 | 15×15 尺 | 3 |
| 超巨型 | 20×20 尺或更大 | 4 |

---

## 建议表结构（Laravel）
- `characters`(id:string PK, name:string, payload:json, updated_at)
- `parties`(id:string PK, name:string, payload:json, updated_at)
- `initiative_results`(单行, payload:json, updated_at)
- `map_state`(单行, payload:json 存 `{tokens,indicators,npcs}`, updated_at)
