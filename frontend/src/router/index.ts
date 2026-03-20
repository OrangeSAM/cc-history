import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import ProjectView from '../views/ProjectView.vue'
import SessionView from '../views/SessionView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },
    {
      path: '/project/:slug',
      name: 'project',
      component: ProjectView,
      props: true
    },
    {
      path: '/session',
      name: 'session',
      component: SessionView
    }
  ]
})

export default router
