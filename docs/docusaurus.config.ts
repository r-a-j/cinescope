import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Cinescope Docs',
  tagline: 'Track movies and TV series effortlessly',
  favicon: 'img/favicon.png',

  // Set the production url of your site here
  url: 'https://docs.cinescope-prod-raj-admin.app',
  baseUrl: '/',

  organizationName: 'r-a-j',
  projectName: 'cinescope',

  onBrokenLinks: 'throw',
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
    format: 'mdx',
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          // --- INSTANCE 1: USER DOCS ---
          id: 'default',
          path: 'user-docs', // The local folder name
          routeBasePath: 'users', // The URL path (e.g., domain.com/users)
          sidebarPath: './sidebarsUser.ts',
          editUrl: 'https://github.com/r-a-j/cinescope/tree/master/docs/',
        },
        blog: false, // Disabling the blog to keep the site strictly focused on docs
        theme: {
          customCss: './src/css/custom.scss',
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: ['docusaurus-theme-openapi-docs'],

  plugins: [
    'docusaurus-plugin-sass',

    function customWebpackPlugin() {
      return {
        name: 'custom-webpack-plugin',
        configureWebpack() {
          return {
            resolve: {
              fallback: {
                // Tells Webpack to use the browserify version of 'path'
                path: require.resolve('path-browserify'),
              },
            },
          };
        },
      };
    },

    [
      'docusaurus-plugin-openapi-docs',
      {
        id: 'api-docs',
        docsPluginId: 'dev-docs', // Inject this into the Developer Docs instance!
        config: {
          cinescope: { // "cinescope" is the ID of this specific API spec
            specPath: 'cinescope-openapi.json',
            outputDir: 'dev-docs/api', // Where it will generate the markdown files
            sidebarOptions: {
              groupPathsBy: 'tag',
              categoryLinkSource: 'tag',
            },
          },
        },
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        // --- INSTANCE 2: DEVELOPER DOCS ---
        id: 'dev-docs',
        path: 'dev-docs', // The local folder name
        routeBasePath: 'developers', // The URL path (e.g., domain.com/developers)
        sidebarPath: './sidebarsDev.ts',
        editUrl: 'https://github.com/r-a-j/cinescope/tree/master/docs/',
        docItemComponent: '@theme/ApiItem',
      },
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: true,
      respectPrefersColorScheme: false,
    },
    navbar: {
      logo: {
        alt: 'Cinescope Logo',
        src: 'img/logo-header.svg',
      },
      items: [
        {
          to: '/users/', // Routes to the User Docs instance
          label: 'User Guide',
          position: 'left',
          activeBaseRegex: `/users/`,
        },
        {
          to: '/developers/', // Routes to the Dev Docs instance
          label: 'Developer Docs',
          position: 'left',
          activeBaseRegex: `/developers/`,
        },
        {
          href: 'https://github.com/r-a-j/cinescope',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'User Guide',
              to: '/users/',
            },
            {
              label: 'Developer Architecture',
              to: '/developers/',
            },
          ],
        },
        {
          title: 'Project',
          items: [
            {
              label: 'GitHub Repository',
              href: 'https://github.com/r-a-j/cinescope',
            },
            {
              label: 'Report an Issue',
              href: 'https://github.com/r-a-j/cinescope/issues',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Cinescope. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;