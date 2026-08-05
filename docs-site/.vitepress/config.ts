import { defineConfig } from "vitepress";

export default defineConfig({
  base: "/vscode-ifc/",
  title: "IFC Language Tools",
  description: "VS Code extension documentation for IFC STEP files",
  cleanUrls: true,
  themeConfig: {
    logo: "/assets/logo.svg",
    search: {
      provider: "local",
    },
    nav: [
      { text: "Guide", link: "/getting-started" },
      { text: "Features", link: "/features/hover" },
      { text: "GitHub", link: "https://github.com/NepomukWolf/vscode-ifc" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Getting Started", link: "/getting-started" },
          { text: "Configuration", link: "/configuration" },
          { text: "Troubleshooting", link: "/troubleshooting" },
        ],
      },
      {
        text: "Features",
        items: [
          { text: "Hover", link: "/features/hover" },
          { text: "Navigation", link: "/features/navigation" },
          { text: "Document Symbols", link: "/features/document-symbols" },
          { text: "Editing Assistance", link: "/features/editing-assistance" },
          { text: "Inlay Hints", link: "/features/inlay-hints" },
          { text: "Diagnostics", link: "/features/diagnostics" },
          { text: "Semantic Highlighting", link: "/features/semantic-highlighting" },
          { text: "3D Preview", link: "/features/three-d-preview" },
          { text: "Large Files", link: "/features/large-files" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Development", link: "/development" },
        ],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/NepomukWolf/vscode-ifc" }],
  },
});
