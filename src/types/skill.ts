export interface SkillMeta {
  agentId: string;
  conversationId: string;
  conversationLabel: string;
  isWorker: boolean;
  // v12 org fields — optional, only set when skill is called by an org agent
  orgId?: string;
  orgAgentId?: string;
}

export interface Skill {
  name: string;
  description: string;
  parameters: any;
  run: (args: any, meta: SkillMeta) => Promise<any>;
}
