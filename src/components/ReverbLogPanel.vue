<template>
  <div class="wslog" :class="{ open: open }">
    <div class="wslog-head">
      <button class="wslog-toggle" @click="open = !open">
        {{ open ? '−' : '📡' }}
      </button>
      <span class="wslog-title">📡 长连接收发日志（{{ entries.length }}）</span>
      <span class="wslog-state" :class="stateCls">{{ stateText }}</span>
      <button class="wslog-clear" title="清空" @click="clear">清空</button>
    </div>
    <div v-if="open" ref="listEl" class="wslog-list">
      <div v-if="!entries.length" class="wslog-empty">暂无记录：加入战斗会话/编辑角色卡后，这里会实时显示收到的广播事件与发出的请求。</div>
      <div v-for="(e, i) in entries" :key="e.ts + '-' + i" class="wslog-row" :class="e.dir">
        <span class="wslog-time">{{ fmtTime(e.ts) }}</span>
        <span class="wslog-ic">{{ ic(e.dir) }}</span>
        <span class="wslog-chan">{{ e.chan }}</span>
        <span class="wslog-label">{{ e.label }}</span>
        <span v-if="e.detail" class="wslog-detail" :title="e.detail">{{ e.detail }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useWsLog, clearWsLog } from '../api/wsLog'

const { entries } = useWsLog()
const open = ref(true)
const listEl = ref<HTMLDivElement | null>(null)

watch(
  entries,
  async () => {
    await nextTick()
    if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
  },
  { deep: false }
)

function fmtTime(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`
}
function ic(dir: string): string {
  return dir === 'in' ? '▲' : dir === 'out' ? '▼' : dir === 'err' ? '✕' : '●'
}
function clear() {
  clearWsLog()
}

const stateText = computed(() => {
  const last = entries.value.slice().reverse().find((e) => e.chan === 'echo' && e.label === 'WS状态')
  const lastErr = entries.value.slice().reverse().find((e) => e.dir === 'err')
  if (last && last.detail?.includes('connected')) return 'WS 已连接'
  if (last) return (last.detail || '').split(' → ').pop() || '…'
  if (lastErr) return 'WS 异常'
  return '待连接'
})
const stateCls = computed(() => {
  const t = stateText.value
  if (t.includes('已连接')) return 'good'
  if (t.includes('异常') || t.includes('failed') || t.includes('unavailable')) return 'bad'
  return 'wait'
})
</script>

<style scoped>
.wslog {
  margin-top: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #0f172a;
  color: #cbd5e1;
  font-size: 12px;
  overflow: hidden;
}
.wslog-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: #1e293b;
}
.wslog-toggle {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 14px;
}
.wslog-title {
  font-weight: 600;
  color: #e2e8f0;
}
.wslog-state {
  margin-left: auto;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  background: #334155;
}
.wslog-state.good {
  background: #14532d;
  color: #4ade80;
}
.wslog-state.bad {
  background: #7f1d1d;
  color: #fca5a5;
}
.wslog-state.wait {
  background: #713f12;
  color: #fcd34d;
}
.wslog-clear {
  background: none;
  border: 1px solid #475569;
  color: #94a3b8;
  border-radius: 6px;
  padding: 1px 8px;
  cursor: pointer;
  font-size: 11px;
}
.wslog-list {
  max-height: 220px;
  overflow: auto;
  padding: 6px 10px;
}
.wslog-empty {
  color: #64748b;
  padding: 8px 0;
}
.wslog-row {
  display: flex;
  gap: 8px;
  align-items: baseline;
  padding: 2px 0;
  border-bottom: 1px dashed #334155;
  white-space: nowrap;
}
.wslog-row:last-child {
  border-bottom: none;
}
.wslog-time {
  color: #64748b;
  font-variant-numeric: tabular-nums;
  flex: 0 0 auto;
}
.wslog-ic {
  flex: 0 0 auto;
  width: 16px;
  text-align: center;
}
.wslog-row.in .wslog-ic {
  color: #38bdf8;
}
.wslog-row.out .wslog-ic {
  color: #4ade80;
}
.wslog-row.err .wslog-ic {
  color: #f87171;
}
.wslog-row.sys .wslog-ic {
  color: #fbbf24;
}
.wslog-chan {
  color: #94a3b8;
  flex: 0 0 auto;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.wslog-label {
  color: #e2e8f0;
  font-weight: 600;
  flex: 0 0 auto;
}
.wslog-detail {
  color: #7dd3fc;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
