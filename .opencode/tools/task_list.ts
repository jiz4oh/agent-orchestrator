import { tool } from "@opencode-ai/plugin";
import { listTasks } from "../../src/core.mjs";
export default tool({
  description:"List persisted worker tasks and optionally check live OpenCode V2 active sessions.",
  args:{refresh:tool.schema.boolean().optional()},
  async execute(args){return JSON.stringify(await listTasks(args));}
});
