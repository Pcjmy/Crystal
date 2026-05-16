---
title: 模型接入
---

## Provider 选择

对使用者而言，Crystal 的模型接入就是两件事：

1. 选择一个可用的 OpenAI 兼容网关（或官方接口）
2. 配好 Base URL、Model 和 API Key

## OpenAI 兼容协议（当前对外方式）

Crystal 通过 `POST /chat/completions` 的 SSE 流式读取响应。

## 环境变量

当 Provider 选择为 `openai` 时，Crystal 需要读取以下环境变量（不提供默认值）：

- `CRYSTAL_PROVIDER`：`openai`
- `CRYSTAL_BASE_URL`：OpenAI 兼容 Base URL（通常形如 `https://<host>/v1`）
- `CRYSTAL_MODEL`：模型名称（由你的网关决定）
- `CRYSTAL_API_KEY`：API Key（不要写进仓库）

仓库内提供 `.env.example`，并且 CLI 启动时会自动读取本地 `.env`（`.env` 已被 `.gitignore` 忽略）。

## 启动示例

PowerShell：

```powershell
$env:CRYSTAL_PROVIDER="openai"
$env:CRYSTAL_BASE_URL="https://your-gateway.example/v1"
$env:CRYSTAL_MODEL="openai/gpt-5-mini"
$env:CRYSTAL_API_KEY="YOUR_API_KEY"
```

运行：

```bash
crystal chat --provider openai
```

## 开发者说明

仓库内部也提供 `mock` provider 用于本地开发与调试，但它不是面向用户的使用方式，文档不建议用户依赖它来完成真实任务。
