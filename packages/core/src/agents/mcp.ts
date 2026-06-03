import { BaseAgent, AgentContext } from './base-agent.js';
import { AgentAction } from '../events/types.js';
import { v4 as uuidv4 } from 'uuid';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CallToolResultSchema, ListToolsResultSchema } from '@modelcontextprotocol/sdk/types.js';

export class MCPAgent extends BaseAgent {
    constructor(events: any, llmProvider: any) {
        super(
            {
                role: 'mcp',
                name: 'MCP Integration Agent',
                description: 'Responsible for integrating with third-party tools via MCP (Model Context Protocol). It acts as a Zero to Hero agent giving Monnu Clow external capabilities.',
                maxRetries: 3,
                timeoutMs: 120000, // 2 mins due to external calls
            },
            events,
            llmProvider
        );
    }

    protected async performWork(context: AgentContext): Promise<AgentAction[]> {
        this.log('info', 'Analyzing MCP requirements and executing actions via external integrations...');

        if (!this.llm) {
            this.log('warn', 'No LLM provider available, skipping MCP operations');
            return [];
        }

        const actions: AgentAction[] = [];

        // Parse configurations from environment
        // Expected format: MCP_SERVERS='[{"name":"neon","command":"npx","args":["-y","@neondatabase/mcp-server"]}]'
        let serverConfigs = [];
        try {
            if (process.env.MCP_SERVERS) {
                serverConfigs = JSON.parse(process.env.MCP_SERVERS);
            }
        } catch (e) {
            this.log('error', `Failed to parse MCP_SERVERS env var: ${e}`);
        }

        if (!serverConfigs || serverConfigs.length === 0) {
             this.log('info', 'No MCP servers configured in MCP_SERVERS environment variable.');
             return actions;
        }

        for (const config of serverConfigs) {
            this.log('info', `Connecting to MCP Server: ${config.name}`);
            try {
                const transport = new StdioClientTransport({
                    command: config.command,
                    args: config.args || [],
                    env: config.env || process.env
                });

                const client = new Client({
                    name: "monnu-clow-mcp-client",
                    version: "1.0.0"
                }, {
                    capabilities: {}
                });

                await client.connect(transport);

                // Fetch tools
                const toolsResult = await client.request(
                    { method: "tools/list" },
                    ListToolsResultSchema
                );

                if (toolsResult.tools.length === 0) {
                     this.log('info', `No tools found for MCP Server: ${config.name}`);
                     await client.close();
                     continue;
                }

                this.log('info', `Fetched ${toolsResult.tools.length} tools from ${config.name}. Invoking LLM...`);

                // Create tool definitions for the LLM
                const llmTools = toolsResult.tools.map((t: any) => ({
                    name: t.name,
                    description: t.description,
                    parameters: t.inputSchema || {}
                }));

                const systemPrompt = `You are the MCP Integration Agent for Monnu Clow. You have access to external tools via the MCP protocol.
Analyze the current iteration: ${context.iteration} and previous actions to decide if you need to invoke any external tool.
If a tool is needed to complete pending tasks, stabilize the system, or investigate, use it. Otherwise, explain why no action is needed.`;

                const promptStr = `What external MCP tool action should we take to help the repository become zero-to-hero?
Please respond with a JSON block if a tool is needed, like this:
{ "tool": "tool_name", "args": { "param1": "value" } }
Available tools: ${JSON.stringify(llmTools)}`;

                const response = await this.llm.chat([
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: promptStr }
                ]);


                // In a robust implementation, the LLM response is parsed for tool commands.
                // Since this repository's BaseLLMProvider currently only supports simple text 'chat',
                // we simulate the tool call logic using the text response from the LLM.

                // Parse tool calls heuristically from text response, looking for JSON blocks.
                let toolCalls: any[] = [];
                try {
                    // Look for JSON-like block in the response content.
                    const startIdx = response.content.indexOf('{');
                    const endIdx = response.content.lastIndexOf('}');

                    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
                        const jsonStr = response.content.substring(startIdx, endIdx + 1);
                        const parsed = JSON.parse(jsonStr);
                        if (parsed.tool && parsed.args) {
                            toolCalls.push({
                                name: parsed.tool,
                                arguments: parsed.args
                            });
                        }
                    }
                } catch(e) {
                    // Ignore parsing errors
                }

                if (toolCalls.length > 0) {
                     for (const call of toolCalls) {
                         this.log('info', `Executing tool: ${call.name} on server ${config.name}`);

                         const result = await client.request(
                            {
                                method: "tools/call",
                                params: {
                                    name: call.name,
                                    arguments: call.arguments as any
                                }
                            },
                            CallToolResultSchema
                        );

                        this.log('success', `Tool ${call.name} executed. Result: ${JSON.stringify(result.content)}`);

                        actions.push({
                            id: uuidv4(),
                            agentRole: 'mcp',
                            action: 'mcp_tool_call',
                            detail: `Executed ${call.name} on ${config.name}`,
                            timestamp: Date.now(),
                            duration: 0,
                            result: result.isError ? 'failure' : 'success',
                            metadata: {
                                tool: call.name,
                                args: call.arguments,
                                result: result.content
                            }
                        });
                     }
                } else {
                     this.log('info', `LLM decided no tools from ${config.name} were needed at this time.`);
                }

                await client.close();

            } catch (error) {
                this.log('error', `MCP Integration failed for ${config.name}: ${error}`);
                actions.push({
                    id: uuidv4(),
                    agentRole: 'mcp',
                    action: 'mcp_integration',
                    detail: String(error),
                    timestamp: Date.now(),
                    duration: 0,
                    result: 'failure',
                    metadata: { server: config.name }
                });
            }
        }

        return actions;
    }
}
