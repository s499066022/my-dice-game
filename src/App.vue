<template>
  <div class="app-shell">
    <nav class="app-nav">
      <span class="app-logo">🎲 DnD 工具箱</span>
      <div class="app-links">
        <router-link to="/dice">🎲 先攻骰</router-link>
        <router-link to="/cards">🗂️ 角色卡</router-link>
        <router-link to="/party">👥 团</router-link>
      </div>
      <a class="external" href="https://5echm.kagangtuya.top/" target="_blank">
        5E 不全书 ↗
      </a>
    </nav>

    <router-view />
  </div>
</template>

<script lang="ts" setup></script>

<style scoped>
.app-shell {
  min-height: 100vh;
}

.app-nav {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  padding: 10px 16px;
  margin-bottom: 16px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
}

.app-logo {
  font-weight: 700;
  font-size: 16px;
  white-space: nowrap;
}

.app-links {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.app-links a {
  padding: 6px 12px;
  border-radius: 8px;
  color: #4b5563;
  font-size: 14px;
  transition: background 0.15s, color 0.15s;
}

.app-links a:hover {
  background: #f3f4f6;
  color: #1f2937;
}

.app-links a.router-link-active {
  background: #eef2ff;
  color: #4f46e5;
  font-weight: 600;
}

.external {
  margin-left: auto;
  font-size: 13px;
  color: #6366f1;
  white-space: nowrap;
}
</style>
