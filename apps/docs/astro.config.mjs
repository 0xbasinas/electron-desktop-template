import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import tailwindcss from '@tailwindcss/vite'
import { monoDark, monoLight } from './mono-themes.mjs'

const REPO = 'https://github.com/0xbasinas/electron-desktop-template'

// The pages under "Guides" and "Reference" are generated from /docs by scripts/sync-docs.mjs, so the Markdown in
// /docs stays the one source of truth. Only the home page (src/content/docs/index.mdx) is written here.
export default defineConfig({
  // The diagram library is a big chunk on purpose: it is only fetched on pages that have a diagram.
  vite: { plugins: [tailwindcss()], build: { chunkSizeWarningLimit: 1500 } },
  integrations: [
    starlight({
      title: 'Electron Desktop Template',
      description:
        'Build, ship and update an Electron desktop app with a website, an API and sign-in.',
      favicon: '/favicon.svg',
      customCss: ['./src/styles/global.css', './src/styles/theme.css'],
      components: {
        Footer: './src/components/Footer.astro',
        MarkdownContent: './src/components/MarkdownContent.astro',
        PageTitle: './src/components/PageTitle.astro',
        ThemeSelect: './src/components/ThemeSelect.astro'
      },
      // Starlight marks the theme with data-theme; the web app's theme file uses a "dark" class. Keep them in step.
      head: [
        {
          tag: 'script',
          content:
            "(function(){var r=document.documentElement;function s(){r.classList.toggle('dark',r.dataset.theme==='dark')}s();new MutationObserver(s).observe(r,{attributes:true,attributeFilter:['data-theme']})})()"
        }
      ],
      social: [{ icon: 'github', label: 'GitHub', href: REPO }],
      editLink: { baseUrl: `${REPO}/edit/main/docs/` },
      lastUpdated: false,
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      expressiveCode: {
        themes: [monoDark, monoLight],
        styleOverrides: { borderRadius: '0.625rem', borderColor: 'var(--sl-color-gray-5)' }
      },
      sidebar: [
        { label: 'Start here', items: [{ slug: 'index' }] },
        {
          label: 'Guides',
          items: [{ slug: 'guides/setup-cloud' }, { slug: 'guides/template-updates' }]
        },
        {
          label: 'The desktop app',
          items: [
            { slug: 'desktop/architecture' },
            { slug: 'desktop/window-and-menus' },
            { slug: 'desktop/app-features' },
            { slug: 'desktop/security' },
            { slug: 'desktop/account-sign-in' }
          ]
        },
        {
          label: 'Releasing',
          items: [
            { slug: 'releasing/overview', label: 'Overview' },
            { slug: 'releasing/rollouts' },
            { slug: 'releasing/checks-and-security' }
          ]
        },
        {
          label: 'Website and API',
          items: [
            { slug: 'project/monorepo-and-web' },
            { slug: 'api/overview', label: 'API overview' },
            { slug: 'api/sign-in' },
            { slug: 'api/accounts' },
            { slug: 'api/operations' }
          ]
        }
      ]
    })
  ]
})
