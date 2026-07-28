import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const isDev = process.env.NODE_ENV === "development";

const config: Config = {
  title: "NeoWatch API",
  tagline: "REST API for NeoWatch - movies and TV shows streaming platform",
  url: "https://docs.neome.uk",
  baseUrl: "/",
  onBrokenLinks: isDev ? "throw" : "warn",
  onBrokenMarkdownLinks: "warn",
  favicon: "img/favicon.ico",

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
          spec: { url: "/openapi.json" },
          hideModels: false,
          hideDownloadButton: false,
        },
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
          showLastUpdateTime: true,
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
      title: "NeoWatch API",
      logo: {
        alt: "NeoWatch Logo",
        src: "img/logo.svg",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "tutorialSidebar",
          position: "left",
          label: "Docs",
        },
        {
          type: "localeDropdown",
          position: "right",
        },
        {
          href: "https://github.com/anomalyco/neowatch-api-ts",
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
            { label: "NeoWatch", href: "https://w.neome.uk" },
            { label: "Blog", href: "https://blog.neome.uk" },
            { label: "NeoID", href: "https://id.neome.uk" },
          ],
        },
        {
          title: "Community",
          items: [
            { label: "Telegram", href: "https://t.me/neowatch_news" },
            { label: "GitHub", href: "https://github.com/anomalyco/neowatch-api-ts" },
          ],
        },
      ],
      copyright: `© 2024-${new Date().getFullYear()} Neo-Open-Source`,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
