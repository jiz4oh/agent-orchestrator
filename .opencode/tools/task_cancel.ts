import { tool } from "@opencode-ai/plugin";
import { cancelTask } from "../../src/core.mjs";
export default tool({
  description:"Interrupt a running worker session and mark its task cancelled.",
  args:{id:tool.schema.string()},
  async execute(args){return JSON.stringify(await cancelTask(args));}
});
