import { tool } from "@opencode-ai/plugin";
import { sendTask } from "../../src/core.mjs";
export default tool({
  description:"Real-time steer a running OpenCode V2 worker session (or opt into queue). Does not abort running work.",
  args:{id:tool.schema.string(),instruction:tool.schema.string(),delivery:tool.schema.enum(["steer","queue"]).optional()},
  async execute(args){return JSON.stringify(await sendTask(args));}
});
