---
title: 工具与权限
---

## 工具（一期）

Crystal 当前提供一组最小工具集，用于让模型在代码库里“做事”：

- `readFile`：读取文件内容
- `search`：在工作区内搜索字符串
- `editFile`：写入文件内容
- `runCommand`：执行命令（PowerShell）

## 权限策略

默认策略更保守：

- 不允许写文件
- 不允许执行命令

按需显式开启：

```bash
crystal chat --allow-edit --allow-run
```

说明：工具的权限控制与沙箱策略属于内部实现细节，用户只需要理解“默认安全、按需放权”的使用方式。

