import axios, { AxiosInstance } from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.PAPERCLIP_API_KEY;
const API_URL = process.env.PAPERCLIP_API_URL || 'http://localhost:3100';

let paperclipClient: AxiosInstance | null = null;

function getClient(): AxiosInstance {
    if (!paperclipClient) {
        paperclipClient = axios.create({
            baseURL: `${API_URL}/api`,
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 5000
        });
    }
    return paperclipClient;
}

let cachedMe: any = null;

/**
 * Check if the Paperclip server is reachable.
 */
async function isServerAvailable(): Promise<boolean> {
    try {
        await axios.get(`${API_URL}/`, { timeout: 3000 });
        return true;
    } catch {
        return false;
    }
}

async function getMe() {
    if (cachedMe) return cachedMe;
    const client = getClient();
    const response = await client.get('/agents/me');
    cachedMe = response.data;
    return cachedMe;
}

export const paperclipSkill = {
    name: 'paperclip_orchestration',
    description: 'Management layer tools to interact with Paperclip tasks, agents, and company-level strategy. Requires the Paperclip server to be running on localhost:3100 (start with: npx paperclipai onboard --yes).',
    parameters: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['check_status', 'get_identity', 'list_assignments', 'checkout_task', 'update_task', 'add_comment', 'create_subtask'],
                description: 'The operation to perform. Use "check_status" first to verify the Paperclip server is running.'
            },
            issueId: { type: 'string', description: 'The ID or identifier (e.g., PER-1) of the issue.' },
            status: { type: 'string', enum: ['todo', 'in_progress', 'done', 'blocked', 'cancelled'], description: 'New status for the task.' },
            comment: { type: 'string', description: 'Markdown comment for status updates or communication.' },
            title: { type: 'string', description: 'Title for a new subtask.' },
            description: { type: 'string', description: 'Description for a new subtask.' },
            assigneeAgentId: { type: 'string', description: 'Target agent ID for assignments.' }
        },
        required: ['action']
    },
    run: async (args: any) => {
        // Check if API key is configured
        if (!API_KEY) {
            return {
                error: 'Paperclip is not configured. Set PAPERCLIP_API_KEY in your .env file.',
                hint: 'Run "npx paperclipai onboard --yes" to set up Paperclip first.'
            };
        }

        const { action, issueId, status, comment, title, description, assigneeAgentId } = args;

        // Quick status check action
        if (action === 'check_status') {
            const available = await isServerAvailable();
            return {
                server_url: API_URL,
                available,
                message: available
                    ? 'Paperclip server is running and reachable.'
                    : `Paperclip server is not running at ${API_URL}. Start it with: npx paperclipai onboard --yes`
            };
        }

        // For all other actions, verify server is up first
        const available = await isServerAvailable();
        if (!available) {
            return {
                error: `Paperclip server is not running at ${API_URL}.`,
                hint: 'Start the Paperclip server first with: npx paperclipai onboard --yes',
                action_attempted: action
            };
        }

        try {
            const me = await getMe();
            const client = getClient();

            switch (action) {
                case 'get_identity':
                    return me;

                case 'list_assignments':
                    const listRes = await client.get(`/companies/${me.companyId}/issues`, {
                        params: {
                            assigneeAgentId: me.id,
                            status: 'todo,in_progress,blocked'
                        }
                    });
                    return listRes.data;

                case 'checkout_task':
                    if (!issueId) return { error: 'issueId is required for checkout.' };
                    const checkoutRes = await client.post(`/issues/${issueId}/checkout`, {
                        agentId: me.id,
                        expectedStatuses: ['todo', 'backlog', 'blocked']
                    }, {
                        headers: { 'X-Paperclip-Run-Id': `run_${Date.now()}` }
                    });
                    return checkoutRes.data;

                case 'update_task':
                    if (!issueId) return { error: 'issueId is required for update.' };
                    const updateRes = await client.patch(`/issues/${issueId}`, {
                        status,
                        comment
                    }, {
                        headers: { 'X-Paperclip-Run-Id': `run_${Date.now()}` }
                    });
                    return updateRes.data;

                case 'add_comment':
                    if (!issueId) return { error: 'issueId is required for comments.' };
                    const commentRes = await client.post(`/issues/${issueId}/comments`, {
                        body: comment
                    });
                    return commentRes.data;

                case 'create_subtask':
                    const subtaskRes = await client.post(`/companies/${me.companyId}/issues`, {
                        title,
                        description,
                        parentId: issueId,
                        assigneeAgentId: assigneeAgentId || null
                    });
                    return subtaskRes.data;

                default:
                    return { error: `Unknown action: ${action}` };
            }
        } catch (error: any) {
            const statusCode = error.response?.status;
            const detail = error.response?.data;

            // Provide actionable error messages
            if (statusCode === 401 || statusCode === 403) {
                cachedMe = null; // Clear stale identity cache
                return {
                    error: 'Authentication failed with Paperclip server.',
                    hint: 'Check your PAPERCLIP_API_KEY in .env. You may need to re-run: npx paperclipai onboard --yes',
                    detail
                };
            }

            console.error(`[Paperclip] ${action} failed (HTTP ${statusCode || 'N/A'}):`, error.message);
            return {
                error: `Paperclip ${action} failed: ${error.message}`,
                detail: detail || undefined
            };
        }
    }
};
