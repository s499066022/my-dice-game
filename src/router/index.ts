// src/router/index.ts
import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
import DiceView from '../views/diceView.vue'
import Combattools from '../views/combattools.vue'
import CharacterCreator from '../views/CharacterCreator/CharacterCreator.vue'
import CharacterManager from '../views/CharacterManager.vue'

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
    path: '/characters',
    name: 'Characters',
    component: CharacterCreator
  },

  {
    path: '/combattools',
    name: 'Combattools',
    component: Combattools
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
