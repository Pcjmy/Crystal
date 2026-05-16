#!/usr/bin/env bun
import { loadDotEnv } from "../infra/dotenv";
import { Command } from "commander";
import { runChat } from "./commands/chat";
import { runOnce } from "./commands/run";

await loadDotEnv();

const program = new Command();

program.name("crystal").description("Crystal — terminal-first agentic loop").version("0.1.0");

program
  .option("--root <path>", "workspace root (defaults to cwd)")
  .option("--allow-run", "allow running shell commands", process.env.CRYSTAL_ALLOW_RUN === "true" || false)
  .option("--allow-edit", "allow editing files", process.env.CRYSTAL_ALLOW_EDIT === "true" || false)
  .option("--provider <provider>", "model provider (mock|openai)", process.env.CRYSTAL_PROVIDER ?? "mock")
  .option("--model <model>", "model name", process.env.CRYSTAL_MODEL)
  .option("--base-url <url>", "model base url", process.env.CRYSTAL_BASE_URL);

program
  .command("chat")
  .description("Start an interactive chat session")
  .action(async () => {
    const opts = program.opts();
    if (opts.provider) process.env.CRYSTAL_PROVIDER = String(opts.provider);
    if (opts.model) process.env.CRYSTAL_MODEL = String(opts.model);
    if (opts.baseUrl) process.env.CRYSTAL_BASE_URL = String(opts.baseUrl);
    await runChat({
      workspaceRoot: opts.root ?? process.cwd(),
      allowRun: Boolean(opts.allowRun),
      allowEdit: Boolean(opts.allowEdit),
    });
  });

program
  .command("run")
  .description("Run a one-shot task")
  .argument("<task...>", "task text")
  .action(async (taskParts: string[]) => {
    const opts = program.opts();
    if (opts.provider) process.env.CRYSTAL_PROVIDER = String(opts.provider);
    if (opts.model) process.env.CRYSTAL_MODEL = String(opts.model);
    if (opts.baseUrl) process.env.CRYSTAL_BASE_URL = String(opts.baseUrl);
    await runOnce({
      workspaceRoot: opts.root ?? process.cwd(),
      allowRun: Boolean(opts.allowRun),
      allowEdit: Boolean(opts.allowEdit),
      task: taskParts.join(" "),
    });
  });

program
  .command("config")
  .description("Show effective config (Phase 1 minimal)")
  .action(() => {
    const opts = program.opts();
    const config = {
      workspaceRoot: opts.root ?? process.cwd(),
      allowRun: Boolean(opts.allowRun),
      allowEdit: Boolean(opts.allowEdit),
      provider: opts.provider ?? process.env.CRYSTAL_PROVIDER ?? "mock",
      model: opts.model ?? process.env.CRYSTAL_MODEL ?? "gpt-5",
      baseUrl: opts.baseUrl ?? process.env.CRYSTAL_BASE_URL ?? "https://ai.nengyongai.cn/v1",
      hasApiKey: Boolean(process.env.CRYSTAL_API_KEY),
    };
    process.stdout.write(`${JSON.stringify(config, null, 2)}\n`);
  });

program
  .command("doctor")
  .description("Print environment diagnostics")
  .action(() => {
    const info = {
      bunVersion: process.versions.bun,
      nodeVersion: process.versions.node,
      platform: process.platform,
      arch: process.arch,
      cwd: process.cwd(),
    };
    process.stdout.write(`${JSON.stringify(info, null, 2)}\n`);
  });

await program.parseAsync(process.argv);
