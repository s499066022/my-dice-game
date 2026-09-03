# DnD 工具箱（我的骰子游戏）

一套 5e 跑团/战棋辅助工具：**角色卡库 · 团 · 先攻骰 · 六边形战斗地图**，用
**Laravel + Reverb 长连接**做多设备实时同步（无需刷新），辅以 REST 兜底。

- 前端：Vue3 `<script setup>` + TypeScript + Vite + Element Plus（repo `s499066022/my-dice-game`）
- 后端：Laravel + Reverb（repo `s499066022/chain`），接口契约见 [API.md](./API.md)

---

## 一、页面与功能速览

| 页面 | 做什么 | 数据/同步方式 |
|---|---|---|
| 🎲 先攻骰 `/dice` | 掷先攻、排序、结果共享（暂无长连接维护，REST 周期同步） | REST `/initiative` + 本地状态 |
| 🗂️ 角色卡 `/cards` | 角色卡库：列表默认加载**战斗/资源**页；各选项卡（基础/技能/装备/特性/法术/财富）**按需分块加载**；战斗数据**实时** | v2：`/characters/light` + `blocks` + 独立分页 `/spells`；`presence-characters` |
| 👥 团 `/party` | 建团、拉角色（唯一归属）、成员管理 | REST `/parties`（改动自动发布）+ `presence-parties` 实时广播 |
| 🗺️ 地图 `/map` | 战斗会话：参战者对账、拖拽移动、先攻行动顺序、扣血、换位、回合、锁定、尺子、锥/圆法术区（可绑定跟随）；**长连接收发日志** | `presence-combat.{团id}` 全量实时；REST 写入+广播 |

**共享能力**
- 📚 **法术库**（角色卡内）：内置 543 条（由 `m.xlsx` 转换）+ 自定义入库；像“选武器”一样搜索/按环位筛选/分页挑选加入角色。
- 🧪 **示例角色**：固定 id（`sample-barbarian`/`sample-mage`），可重复点击不重复添加。
- 📡 **收发日志**：地图页下方实时面板，展示 WS 状态 / 收广播事件 / 发 REST 请求 / 错误，便于排查“不同步”。

---

## 二、数据与同步模型（重要概念）

1. **角色卡 = payload(分块) + 独立法术表**：列表只用“LightCard”（名字+战斗核心，含 AC 三要素与属性，够算 AC/先攻）；
   编辑其它选项卡才 `GET /characters/{id}/blocks/{block}` 懒加载，改哪块只 `PATCH` 哪块（小载荷、并发友好）。
2. **法术独立分页**：`character_spells` 独立表，服务端 `page/per_page/q/level(0-9)` 分页过滤；不再整卡携带。
3. **团 id = 战斗会话 id**：选团即“创建/加入”会话；参战者 = 团成员角色 + 怪物；同一角色卡（ref_id）只能入一次。
4. **三个实时频道**：
   - `presence-characters` —— 角色卡块更新/删除、法术增删改；
   - `presence-parties` —— 团列表全量广播；
   - `presence-combat.{团id}` —— 会话全量（站位/HP/先攻/回合/法术区/锁定）。
5. **兜底**：WS 不可用/离线时自动回退 REST+localStorage；恢复后按块/整库自愈。

---

## 三、本地开发

### 后端（Docker，`/Users/shenchunye/docker/www/chain/php` 已挂载）
```bash
# 依赖容器已就绪（nginx 12226 / php-fpm / mysql / redis）。启动 Laravel 代码内 Reverb：
docker exec -d docker_base-php8 sh -c "cd /www/chain/php && php artisan reverb:start --host=0.0.0.0 --port=8080"
# 验证：curl -i "http://localhost:12226/app/<REVERB_APP_KEY>?protocol=7" 返回 101 即 WS 通
# 停：docker exec docker_base-php8 pkill -f reverb
```
> nginx 已把 `/app`、`/apps` 反代到 php 容器 8080；改后端代码无需重启（opcache 2s 生效）。

### 前端
```bash
npm install
npm run dev        # http://localhost:5173（/api 走 Vite 代理 -> localhost:12226）
```
环境（`.env.development`）：`VITE_API_BASE=/api`；WS host **默认随页面 hostname**
（同机 localhost / 局域网 IP 访问都自动连对 `ws://<hostname>:12226/app/...`），
需要其它地址用 `VITE_REVERB_HOST` 覆盖；联调线上：`VITE_API_PROXY=http://106.12.131.21:12226 npm run dev`。

### 首次数据
任一浏览器打开“角色卡”页自动种子 1 个示例；多设备协作先在一台设备点 **整卡同步** 把卡库上传到共享后端，
再在“团”页建团（改动自动发布），其它设备地图页选同一团即可实时同步。

---

## 四、多设备 / 双浏览器联调要点

1. 所有设备访问**同一后端**（同一局域网 IP + 端口 12226；勿用各自 localhost）。
2. WS `unavailable` → 检查访问地址与 WS host（日志面板可见 `WS状态`），Reverb 是否在跑。
3. 角色卡/团改动走**发布→广播**：设备 A 改后，设备 B 无需刷新即可见（地图面板团下拉 20s 轮询兜底）。
4. 战斗同步验证：A 拖 token/改 HP/掷先攻/锁定/放法术区 → B 实时更新；若某一步没到，看 B 的“收发日志”里是没收到广播还是请求失败。
5. 大改后若数据错乱：先 `GET /characters`（拉）检查，再做整库 `sync`（会覆盖，谨慎）。

---

## 五、法术库

- 内置 543 条来自 `m.xlsx`（源文件已 gitignore；转换脚本 `scripts/convert-spells-xlsx.mjs`，需 `npm i xlsx` 后运行重新生成 `src/data/spellLibrary.json`）。
- 角色卡「法术」页：`📚 从法术库选择`（搜索+全部/0–9环+分页，点“＋ 加入角色”）；`🗂 管理法术库`（自定义入库、删除自定义、恢复标准库）。
- 自定义条目存 localStorage（`dnd-spell-library-custom`），跨设备如需共享可后续接入后端法术库表。

---

## 六、目录结构（前端相关）

```
src/
  api/        characterBackend.ts(REST 客户端) reverb.ts(Echo/频道/日志) wsLog.ts(日志总线)
  components/ CombatSessionPanel.vue ReverbLogPanel.vue DiceGame.vue
              character/ (AbilityPanel SkillPanel ResourceList FeatureList SpellLibraryDialog)
  composables/useCombatSession.ts(战斗会话 store) useSpellLibrary.ts(法术库)
  data/       dndModel.ts cardBlocks.ts partyModel.ts sampleCharacters.ts spellLibrary.json
  views/      CharacterManager.vue PartyManager.vue HexMap.vue diceView.vue
```

---

## 七、常见问题

| 现象 | 处理 |
|---|---|
| 本地设备2 WS `unavailable` | 前端需经 `http://<后端主机IP>:5173` 访问（WS host 随页面 hostname），且后端机 Reverb 已启动 |
| 设备1看不到设备2的团 | 任一设备在“团”页改动即自动发布；地图页 20s 内自动出现（或手动刷新） |
| 角色卡战斗数据不同步 | 确认 `presence-characters` 订阅成功（日志面板），或点一次“整卡同步” |
| 地图不同步 | 确认选择同一团（团id=会话id）、WS 已连、未锁定（锁定时禁移动/增删） |
| 示例角色重复添加 | 已修复为固定 id，重复点击会提示“已在库中” |
| 法术列表看不到环位 | 法术页顶部“全部/0-9环”筛选按钮；法术数量大时用搜索 |

---

## 八、版本提交注意

`.gitignore` 已忽略 `m.xlsx`、`.npm-cache/`、`dist/`、`node_modules/` 等；依赖变更请用 `npm install <pkg>`（勿 `--no-save` 污染 lock）。
文档：接口以 [API.md](./API.md) 为准；历史需求/验收见 [项目改版任务.md](./项目改版任务.md)。

---

*本项目用于 dnd 跑团使用，欢迎 trpg 爱好者参与提交代码来完善本项目。*
