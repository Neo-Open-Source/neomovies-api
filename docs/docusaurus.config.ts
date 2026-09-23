import type { Config } from "@docusaurus/types";
import type * as Preset from "@docusaurus/preset-classic";

const isDev = process.env.NODE_ENV === "development";

const config: Config = {
  title: "NeoWatch API",
  tagline: "REST API for NeoWatch - movies and TV shows streaming platform",
  url: "https://neowatch-api-ts.vercel.app",
  baseUrl: "/",
  onBrokenLinks: isDev ? "throw" : "warn",
  favicon: "img/favicon.png",

  // Scalar's CDN bundle reads process.env at runtime; webpack 5 / Docusaurus 3
  // do not polyfill `process` in the browser, so the /api page crashed with
  // "process is not defined". Minimal shim for client scripts only.
  headTags: [
    {
      tagName: "script",
      attributes: {},
      innerHTML:
        "window.process=window.process||{env:{NODE_ENV:\"production\"}};",
    },
  ],

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
          // Absolute URL — relative /playground/json is ambiguous when docs
          // and API share a host behind path-based routing.
          spec: { url: "https://neowatch-api-ts.vercel.app/playground/json" },
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
          showLastUpdateTime: false,
          showLastUpdateAuthor: false,
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
        src: "img/favicon.png",
      },
      items: [
        {
          type: "docSidebar",
          sidebarId: "tutorialSidebar",
          position: "left",
          label: "Docs",
        },
        {
          label: "GraphQL Playground",
          to: "/graphql",
          position: "left",
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
            { label: "NeoWatch", href: "https://w.neome.uk" },
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
  } satisfies Preset.ThemeConfig,
};

export default config;
