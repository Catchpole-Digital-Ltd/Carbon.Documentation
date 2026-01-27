import { defineConfig } from 'vitepress'
import tailwindcss from 'tailwindcss'
import { tabsMarkdownPlugin } from 'vitepress-plugin-tabs'

const references = [
  {
    text: 'Carbon',
    collapsed: true,
    items: [
      { text: 'Hooks', link: '/references/hooks/' },
      { text: 'Commands', link: '/references/commands/' },
      { text: 'ConVars', link: '/references/convars/' },
      { text: 'Switches', link: '/references/switches/' },
    ],
  },
  {
    text: 'Rust',
    collapsed: true,
    items: [
      { text: 'Blueprints', link: '/references/blueprints/' },
      { text: 'Items', link: '/references/items/' },
      { text: 'Entities', link: '/references/entities/' },
      { text: 'Prefabs', link: '/references/prefabs/' },
      { text: 'ConVars', link: '/references/rust-convars/' },
      { text: 'Commands', link: '/references/rust-commands/' },
    ],
  },
]

const tools = [
  {
    text: 'Control Panel (RCon)',
    collapsed: true,
    items: [
      { text: 'Control Panel', link: '/tools/control-panel/' },
      { text: 'RCon Players', link: '/tools/control-panel/rcon-players' },
    ],
  },
  { text: 'Profiler Panel', link: '/tools/profiler-panel/' },
  { text: 'Server Browser', link: '/tools/server-browser/' },
  { text: 'Changelog Generator', link: '/tools/changelog-generator/' }
]

const siteDescription = 'A fully up-to-date documentation of all things: Carbon, Rust references and somewhat Oxide.'

export default defineConfig({
  title: 'Carbon',
  description: siteDescription,
  base: '/',
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }],
    ['meta', { name: 'viewport', content: 'width=device-width, initial-scale=1.0' }],
    ['meta', { property: 'og:site_name', content: 'Carbon Documentation' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:image', content: '/carbon-bg-sq.webp' }],
    ['meta', { property: 'og:image:width', content: '80' }],
    ['meta', { property: 'og:image:height', content: '80' }],
    ['meta', { property: 'og:url', content: 'https://carbonmod.gg' }],
    ['meta', { name: 'twitter:image', content: '/carbon-bg-sq.webp' }],
  ],
  ignoreDeadLinks: false,
  cleanUrls: true,
  lastUpdated: true,
  sitemap: {
    hostname: 'https://carbonmod.gg',
  },
  lang: 'en-US',
  markdown: {
    image: {
      lazyLoading: true,
    },
    config(md) {
      md.use(tabsMarkdownPlugin)
    },
  },
  themeConfig: {
    logo: '/logos/carbon-logo-small.webp',
    outlineTitle: 'On this page',
    nav: [
      { text: 'Home', link: '/' },
      { text: 'News', link: '/news' },
      { text: 'Tutorials', link: '/tutorials' },
      { text: 'Documentation', items: [
        { text: 'Owners', link: '/owners/getting-started' },
        { text: 'Developers', link: '/devs/local-server-hosting' },
      ]},
      { text: 'References', items: references },
      { text: 'Tools', items: tools },
      { text: 'Commits', link: '/references/commits/' },
      { text: 'Release Notes', link: '/references/release-notes/' }
    ],

    sidebar: {
      '/': [
        { text: 'Getting Started', link: '/owners/getting-started' },
        { text: 'Installing Carbon', link: '/owners/installing-carbon' },
        { text: 'Configuring Carbon', link: '/owners/configuring-carbon' },
        { text: 'Release Notes', link: '/references/release-notes/' },
        {
          text: 'Owners Documentation',
          collapsed: false,
          items: [
            { text: 'Auto Updates', link: '/owners/auto-updates' },
            { text: 'Oxide Porting', link: '/owners/oxide-porting' },
            {
              text: 'Features',
              collapsed: true,
              items: [
                { text: 'Vault', link: '/devs/features/vault' },
                { text: 'Minimal', link: '/owners/features/minimal' },
                { text: 'CarbonAuto', link: '/owners/features/carbonauto' },
                { text: 'Profiler (Mono)', link: '/devs/features/mono-profiler' },
              ],
            },
            {
              text: 'Modules',
              collapsed: true,
              items: [
                { text: 'What are Modules?', link: '/owners/modules/what-are-modules' },
                { text: 'Admin Module', link: '/owners/modules/admin-module' },
                { text: 'Color Picker Module', link: '/owners/modules/color-picker-module' },
                { text: 'Date Picker Module', link: '/owners/modules/date-picker-module' },
                { text: 'File Picker Module', link: '/owners/modules/file-picker-module' },
                { text: 'Image Database Module', link: '/owners/modules/image-db-module' },
                { text: 'Modal Module', link: '/owners/modules/modal-module' },
                {
                  text: 'Optional Modules',
                  collapsed: true,
                  items: [
                    { text: 'AutoWipe Module', link: '/owners/modules/optional-modules/autowipe-module' },
                    {
                      text: 'Circular Networking Module',
                      link: '/owners/modules/optional-modules/circularnetworking-module',
                    },
                    { text: 'Gather Manager Module', link: '/owners/modules/optional-modules/gather-manager-module' },
                    {
                      text: 'Moderation Tools Module',
                      link: '/owners/modules/optional-modules/moderation-tools-module',
                    },
                    { text: 'Selective EAC Module', link: '/owners/modules/optional-modules/selective-eac-module' },
                    { text: 'Stack Manager Module', link: '/owners/modules/optional-modules/stack-manager-module' },
                    { text: 'Vanish Module', link: '/owners/modules/optional-modules/vanish-module' },
                    { text: 'Whitelist Module', link: '/owners/modules/optional-modules/whitelist-module' },
                  ],
                },
              ],
            },
            {
              text: 'Hosting',
              collapsed: true,
              items: [{ text: 'Linux GSM', link: '/owners/linux-gsm' }],
            }
          ],
        },
        {
          text: 'Developer Documentation',
          collapsed: false,
          items: [
            { text: 'Local Server Hosting', link: '/devs/local-server-hosting' },
            { text: 'Creating Your Project', link: '/devs/creating-your-project' },
            { text: 'Creating Your First Plugin', link: '/devs/creating-your-first-plugin' },
            { text: 'Creating Hooks', link: '/devs/creating-hooks' },
            {
              text: 'Features',
              collapsed: true,
              items: [
                { text: 'Async Shutdown', link: '/devs/features/async-shutdown' },
                { text: 'Bridge', link: '/devs/features/bridge' },
                { text: 'Client Entities', link: '/devs/features/client-entities' },
                { text: 'Commands', link: '/devs/features/commands' },
                { text: 'Conditionals', link: '/devs/features/conditionals' },
                { text: 'Extensions', link: '/devs/features/extensions' },
                { text: 'LUI (Lightweight UI)', link: '/devs/features/lightweight-ui' },
                { text: 'Modifiers', link: '/devs/features/modifiers' },
                { text: 'Permissions', link: '/devs/features/permissions' },
                { text: 'Profiler (Mono)', link: '/devs/features/mono-profiler' },
                { text: 'Timers', link: '/devs/features/timers' },
                { text: 'Vault', link: '/devs/features/vault' },
                { text: 'ZIP Scripts & Packages', link: '/devs/features/zip-script-packages' },
              ],
            },
            {
              text: 'Modules',
              collapsed: true,
              items: [
                { text: 'Integrating Modules', link: '/devs/modules/integrating-modules' },
                { text: 'Color Picker Module', link: '/devs/modules/color-picker-module' },
                { text: 'Date Picker Module', link: '/devs/modules/date-picker-module' },
                { text: 'File Picker Module', link: '/devs/modules/file-picker-module' },
                { text: 'Image Database Module', link: '/devs/modules/image-db-module' },
                { text: 'Modal Module', link: '/devs/modules/modal-module' },
              ],
            },
          ],
        },
        {
          text: 'References',
          items: references,
        },
        {
          text: 'Tools',
          items: tools,
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/CarbonCommunity/Carbon.Documentation' },
      { icon: 'discord', link: 'https://discord.gg/carbonmod' },
      { icon: 'twitter', link: 'https://twitter.com/CarbonModGG' },
      { icon: 'youtube', link: 'https://www.youtube.com/@carbonmodgg' },
    ],

    footer: {
      message:
        "Released under the MIT License. Feel free to <a href='https://github.com/CarbonCommunity/Carbon.Documentation' target='_blank'>help us improve</a>!",
      copyright: 'All trademarks referenced are the properties of their respective owners. © 2026 carbonmod.gg and codefling.com All rights reserved.',
    },

    search: {
      provider: 'local',
      options: {
        detailedView: true,
        miniSearch: {
          searchOptions: {
            fuzzy: 0.2,
            prefix: true,
            boost: {
              title: 5,
              headers: 4,
              text: 2,
            },
          },
        },
      },
    },

    editLink: {
      pattern: 'https://github.com/CarbonCommunity/Carbon.Documentation/edit/main/docs/:path',
      text: 'Suggest a change',
    },
  },
  vite: {
    resolve: {
      alias: {
        '@': '/src',
      },
    },
    css: {
      postcss: {
        plugins: [tailwindcss],
      },
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('node_modules/@vueuse/')) return 'vueuse'
              if (id.includes('node_modules/markdown-it/')) return 'markdown'
              if (id.includes('node_modules/lucide-vue-next/')) return 'icons'
              if (id.includes('node_modules/vue-draggable-plus/')) return 'draggable'
              if (id.includes('node_modules/minisearch/')) return 'search'
              if (id.includes('node_modules/shiki/')) return 'shiki'
            }
          },
        },
      },
    },
  },
  vue: {
    template: {
      compilerOptions: {
        isCustomElement: (tag) => tag.includes('-'),
      },
    },
  },
})
