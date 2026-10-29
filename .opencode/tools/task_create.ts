import { tool } from "@opencode-ai/plugin";
import { createTask } from "../../src/core.mjs";
export default tool({
  description:"Create a new background OpenCode V2 worker task, return ID immediately.",
  args:{title:tool.schema.string(),prompt:tool.schema.string(),directory:tool.schema.string().optional(),agent:tool.schema.string().optional()},
  async execute(args){return JSON.stringify(await createTask(args));}
});
