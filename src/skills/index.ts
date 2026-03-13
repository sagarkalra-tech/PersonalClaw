import { shellSkill } from './shell.js';
import { pythonSkill } from './python.js';
import { fileSkill } from './files.js';
import { visionSkill } from './vision.js';
import { clipboardSkill } from './clipboard.js';
import { relaySkill } from './relay.js';
import { memorySkill } from './memory.js';
import { schedulerSkill, initScheduler } from './scheduler.js';
import { Skill } from '../types/skill.js';

import { mcpManager } from '../core/mcp.js';

export const skills: Skill[] = [
  shellSkill,
  pythonSkill,
  fileSkill,
  visionSkill,
  clipboardSkill,
  relaySkill,
  schedulerSkill,
  memorySkill,
];


export { initScheduler };

export const getToolDefinitions = () => {
  const localTools = skills.map(skill => ({
    functionDeclarations: [
      {
        name: skill.name,
        description: skill.description,
        parameters: skill.parameters,
      },
    ],
  }));

  const mcpTools = mcpManager.getTools();
  return [...localTools, ...mcpTools];
};

export const handleToolCall = async (name: string, args: any) => {
  // Check MCP first
  if (mcpManager.isMcpTool(name)) {
    return await mcpManager.callTool(name, args);
  }

  const skill = skills.find(s => s.name === name);
  if (!skill) {
    throw new Error(`Skill ${name} not found`);
  }
  return await skill.run(args);
};
