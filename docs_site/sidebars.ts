import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/**
 * Creating a sidebar enables you to:
 - create an ordered group of docs
 - render a sidebar for each doc of that group
 - provide next/previous navigation

 The sidebars can be generated from the filesystem, or explicitly defined here.

 Create as many sidebars as you want.
 */
const sidebars: SidebarsConfig = {
  // Explicitly define the sidebar for JumpStart documentation
  tutorialSidebar: [
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'quickstart',
        'onboarding',
      ],
    },
    {
      type: 'category',
      label: 'Core Concepts',
      items: [
        'how-jumpstart-works',
        'agent-access-reference',
      ],
    },
  ],
};

export default sidebars;
