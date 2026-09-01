// src/router/index.ts
import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import DiceView from '../views/diceView.vue'
import CharacterManager from '../views/CharacterManager.vue'
import PartyManager from '../views/PartyManager.vue'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/dice',
    name: 'DiceGame',
    component: DiceView
  },
  {
    path: '/cards',
    name: 'CharacterCards',
    component: CharacterManager
  },
  {
    path: '/party',
    name: 'Party',
    component: PartyManager
  },
  {
    path: '/',
    redirect: '/dice'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
