import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'intro',
    'authentication',
    'deployment',
    {
      type: 'category',
      label: 'Guides',
      items: [
        'guides/search',
        'guides/players',
        'guides/favorites',
        'guides/sync-progress',
      ],
    },
  ],
};

export default sidebars;
