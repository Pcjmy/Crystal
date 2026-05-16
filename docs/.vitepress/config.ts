import { defineConfig } from "vitepress";

export default defineConfig({
  lang: "zh-CN",
  title: "Crystal",
  description: "AI 编码助手：理解你的代码库，跨文件与工具完成任务",
  lastUpdated: true,
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: "指南", link: "/guide/getting-started" },
      { text: "工作原理", link: "/guide/how-it-works" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "指南",
          items: [
            { text: "快速开始", link: "/guide/getting-started" },
            { text: "模型接入", link: "/guide/model" },
            { text: "CLI 用法", link: "/guide/cli" },
            { text: "工具与权限", link: "/guide/tools" },
            { text: "终端 UI", link: "/guide/ui" },
            { text: "架构概览", link: "/guide/architecture" },
            { text: "工作原理", link: "/guide/how-it-works" },
          ],
        },
      ],
      "/": [
        {
          text: "Crystal",
          items: [
            { text: "首页", link: "/" },
            { text: "快速开始", link: "/guide/getting-started" },
            { text: "工作原理", link: "/guide/how-it-works" },
          ],
        },
      ],
    },
    socialLinks: [],
    outline: { level: [2, 3] },
    search: { provider: "local" },
    footer: {
      message: "Crystal 文档站",
      copyright: "© Crystal",
    },
  },
});
