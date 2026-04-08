import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  docs: [
    {
      type: "doc",
      id: "intro",
      label: "Introduction",
    },
    {
      type: "doc",
      id: "getting-started",
      label: "Getting Started",
    },
    {
      type: "doc",
      id: "authentication",
      label: "Authentication",
    },
    {
      type: "category",
      label: "Guides",
      items: [
        "guides/search",
        "guides/players",
        "guides/favorites",
      ],
    },
    {
      type: "doc",
      id: "deployment",
      label: "Deployment",
    },
  ],
};

export default sidebars;
