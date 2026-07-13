import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const config: Config = {
  title: "NeoMovies API",
  tagline: "NeoMovies API v2 Documentation",
  url: "https://docs.neome.uk",
  baseUrl: "/",
  onBrokenLinks: "warn",
  favicon: "img/favicon.png",

  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },

  i18n: {
    defaultLocale: "en",
    locales: ["en", "ru"],
    localeConfigs: {
      en: { label: "English", direction: "ltr" },
      ru: { label: "Русский", direction: "ltr" },
    },
  },

  plugins: [
    [
      "@scalar/docusaurus",
      {
        label: "API Reference",
        route: "/api",
        configuration: {
          spec: { url: "/openapi.yaml" },
          hideModels: false,
          hideDownloadButton: false,
        },
      },
    ],
    [
      require.resolve("@easyops-cn/docusaurus-search-local"),
      {
        hashed: true,
        language: ["en", "ru"],
        indexDocs: true,
        indexPages: false,
        docsRouteBasePath: "/docs",
      },
    ],
  ],

  presets: [
    [
      "classic",
      {
        docs: {
          routeBasePath: "/docs",
          sidebarPath: "./sidebars.ts",
          editUrl: "https://gitlab.com/foxixus/neomovies-api/-/edit/main/docs/",
          editLocalizedFiles: true,
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css",
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: "NeoMovies API",
      items: [
        {
          type: "docSidebar",
          sidebarId: "docs",
          position: "left",
          label: "Docs",
        },
        {
          type: "localeDropdown",
          position: "right",
        },
        {
          href: "https://github.com/Neo-Open-Source/neomovies-api",
          label: "GitHub",
          position: "right",
        },
      ],
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Resources",
          items: [
            { label: "NeoMovies", href: "https://w.neome.uk" },
            { label: "Blog", href: "https://blog.neome.uk" },
            { label: "NeoID", href: "https://id.neome.uk" },
          ],
        },
        {
          title: "Community",
          items: [
            { label: "Telegram", href: "https://t.me/neomovies_news" },
            { label: "GitHub", href: "https://github.com/Neo-Open-Source/neomovies-api" },
          ],
        },
      ],
      copyright: `© 2024-${new Date().getFullYear()} Neo-Open-Source`,
    },
    prism: {
      additionalLanguages: ["rust", "bash", "json"],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
