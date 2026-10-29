import { createTask, sendTask, listTasks, cancelTask } from '../../../src/core.mjs';

export default {
  id: 'agent-orchestrator',
  async setup(ctx) {
    await ctx.tool.transform(tools => {
      tools.add({
        name: 'task_create',
        description: 'Create an independent background worker and return its task ID without waiting for completion.',
        input: { type: 'object', properties: {
          title: { type: 'string', minLength: 1 }, prompt: { type: 'string', minLength: 1 },
          directory: { type: 'string' }, agent: { type: 'string' },
        }, required: ['title', 'prompt'], additionalProperties: false },
        options: { codemode: false },
        async execute(input) { return { content: JSON.stringify(await createTask(input)) }; },
      });
      tools.add({
        name: 'task_send',
        description: 'Steer the same running worker at its next processing boundary without interrupting it; queue only when requested.',
        input: { type: 'object', properties: {
          id: { type: 'string' }, instruction: { type: 'string', minLength: 1 },
          delivery: { type: 'string', enum: ['steer', 'queue'] },
        }, required: ['id', 'instruction'], additionalProperties: false },
        options: { codemode: false },
        async execute(input) { return { content: JSON.stringify(await sendTask(input)) }; },
      });
      tools.add({
        name: 'task_list',
        description: 'List durable task/session mappings and optional live activity. Inactivity does not prove task completion.',
        input: { type: 'object', properties: { refresh: { type: 'boolean' } }, additionalProperties: false },
        options: { codemode: false },
        async execute(input) { return { content: JSON.stringify(await listTasks(input)) }; },
      });
      tools.add({
        name: 'task_cancel',
        description: 'Interrupt only the specified worker without resuming pending inputs.',
        input: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false },
        options: { codemode: false },
        async execute(input) { return { content: JSON.stringify(await cancelTask(input)) }; },
      });
    });
  },
};
