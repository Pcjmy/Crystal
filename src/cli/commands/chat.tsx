import React from "react";
import { render } from "ink";
import { createSessionId } from "../../infra/id";
import { ChatApp } from "../../ui/ChatApp";

export async function runChat(params: { workspaceRoot: string; allowRun: boolean; allowEdit: boolean }): Promise<void> {
  const sessionId = createSessionId();
  const { waitUntilExit } = render(
    <ChatApp
      workspaceRoot={params.workspaceRoot}
      sessionId={sessionId}
      allowRun={params.allowRun}
      allowEdit={params.allowEdit}
    />,
  );
  await waitUntilExit();
}
