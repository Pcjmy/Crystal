---
title: CLI 用法
---

## 命令概览

- `crystal chat`：交互会话（终端 UI）
- `crystal run "<任务描述>"`：一次性任务（适合脚本化）
- `crystal config`：查看当前生效配置
- `crystal doctor`：环境诊断

## 常用参数

- `--root <path>`：指定工作区根目录（默认当前目录）
- `--allow-edit`：允许写文件
- `--allow-run`：允许执行命令
- `--provider <mock|openai>`：选择模型 Provider
- `--model <name>`：选择模型名称
- `--base-url <url>`：选择 OpenAI 兼容 Base URL

示例：

```bash
crystal chat --root e:/your/workspace --allow-edit --allow-run --provider openai --model openai/gpt-5-mini
```

## 推荐用法

### 先用“只读模式”熟悉代码库

```bash
crystal chat
```

### 确认无误后再放开权限

```bash
crystal chat --allow-edit --allow-run
```

### 脚本化（CI/自动化场景）

```bash
crystal run "总结一下这个仓库的架构，并给出改进建议"
```

