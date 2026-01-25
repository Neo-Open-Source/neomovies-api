import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'ru-RU',
  title: 'NeoMovies',
  description: 'Документация NeoMovies',
  themeConfig: {
    nav: [
      { text: 'Гайд', link: '/guide/quickstart' },
      { text: 'API', link: '/reference/overview' }
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Гайд',
          items: [
            { text: 'Быстрый старт', link: '/guide/quickstart' },
            { text: 'Конфигурация', link: '/guide/configuration' },
            { text: 'Deploy на Vercel', link: '/guide/deploy-vercel' }
          ]
        }
      ],
      '/reference/': [
        {
          text: 'Reference',
          items: [
            { text: 'Обзор', link: '/reference/overview' },
            { text: 'Auth', link: '/reference/auth' },
            { text: 'Endpoints', link: '/reference/endpoints' },
            { text: 'Models', link: '/reference/models' },
            { text: 'OpenAPI', link: '/reference/openapi' }
          ]
        }
      ]
    }
  }
})
