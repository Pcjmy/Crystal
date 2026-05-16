---
title: 快速开始
---

## 🚀 开始使用（交互式会话）

```bash
crystal chat
```

常用快捷键：

- `?`：显示/隐藏帮助
- `Ctrl+X`：中断当前任务
- `Ctrl+L`：清屏
- `Ctrl+C` / `Esc`：退出

## 🧩 一次性运行（便于脚本化）

```bash
crystal run "在仓库里搜索 ink 的引用"
```

## 🔐 权限开关（重要）

默认情况下，Crystal 以更保守的策略运行（不允许写文件/执行命令）。需要时显式开启：

```bash
crystal chat --allow-edit --allow-run
```

也可以指定工作区根目录：

```bash
crystal chat --root e:/your/workspace
```

## 🧰 工具触发指令（用于演示/调试）

- `/read <path>`：读取文件
- `/search <text>`：搜索字符串
- `/edit <path> <content>`：写入文件（需要开启编辑权限）
- `/run <command>`：执行命令（需要开启执行权限）
