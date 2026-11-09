import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import tailwindcss from '@tailwindcss/vite'

const REPO = 'https://github.com/0xbasinas/electron-desktop-template'

// The pages under "Guides" and "Reference" are generated from /docs by scripts/sync-docs.mjs, so the Markdown in
// /docs stays the one source of truth. Only the home page (src/content/docs/index.mdx) is written here.
export default defineConfig({
  vite: { plugins: [tailwindcss()] },
  integrations: [
    starlight({
      title: 'Electron Desktop Template',
      description:
        'Build, ship and update an Electron desktop app with a website, an API and sign-in.',
      favicon: '/favicon.svg',
      customCss: ['./src/styles/global.css', './src/styles/theme.css'],
      components: { Footer: './src/components/Footer.astro' },
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
