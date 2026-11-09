import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'

const REPO = 'https://github.com/0xbasinas/electron-desktop-template'

// The pages under "Guides" and "Reference" are generated from /docs by scripts/sync-docs.mjs, so the Markdown in
// /docs stays the one source of truth. Only the home page (src/content/docs/index.mdx) is written here.
export default defineConfig({
  integrations: [
    starlight({
      title: 'Electron Desktop Template',
      description:
        'Build, ship and update an Electron desktop app with a website, an API and sign-in.',
      logo: { src: './src/assets/logo.svg' },
      favicon: '/favicon.svg',
      customCss: ['./src/styles/theme.css'],
      social: [{ icon: 'github', label: 'GitHub', href: REPO }],
      editLink: { baseUrl: `${REPO}/edit/main/docs/` },
      lastUpdated: false,
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      expressiveCode: {
        themes: ['github-dark', 'github-light'],
        styleOverrides: { borderRadius: '0.625rem', borderColor: 'var(--sl-color-gray-5)' }
      },
      sidebar: [
        { label: 'Start here', items: [{ slug: 'index' }] },
        {
          label: 'Guides',
          items: [{ slug: 'setup-cloud' }, { slug: 'template-updates' }, { slug: 'releasing' }]
        },
        {
          label: 'Reference',
          items: [{ slug: 'architecture' }, { slug: 'monorepo-and-web' }, { slug: 'api' }]
        }
      ]
    })
  ]
})
