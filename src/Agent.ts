import ChatOpenAI from "./ChatOpenAI.js";
import MCPClient from "./MCPClient.js";
import { logTitle } from "./util.js";

export default class Agent {
    private mcpClients: MCPClient[];
    private llm: ChatOpenAI | null = null;
    private model: string;
    private systemPrompt: string;
    private context: string;

    constructor(model: string, mcpClients: MCPClient[], systemPrompt: string, context: string) {
        this.mcpClients = mcpClients;
        this.model = model;
        this.systemPrompt = systemPrompt;
        this.context = context;
    }

    // Initialize LLM and MCP Clients
    public async init() {
        logTitle("INIT LLM AND TOOLS");

        for (const mcpClient of this.mcpClients) {
            await mcpClient.init();
        }

        // Gather all MCP tools
        const allTools = this.mcpClients.flatMap(c => c.getTools());

        // Corrected parameter order
        this.llm = new ChatOpenAI(this.model, this.systemPrompt, allTools, this.context);
    }

    // Close all MCP clients
    public async close() {
        logTitle("CLOSE MCP CLIENTS");
        for (const client of this.mcpClients) {
            await client.close();
        }
    }

    // Main logic - execute LLM and process tool calls
    // public async invoke(prompt: string) {
    //     if (!this.llm) throw new Error("LLM not initialized");

    //     let response = await this.llm.chat(prompt);

    //     // Add safety loop limit (avoid infinite recursion)
    //     for (let i = 0; i < 10; i++) {
    //         if (response.toolCalls && response.toolCalls.length > 0) {
    //             for (const toolCall of response.toolCalls) {
    //                 const mcp = this.mcpClients.find(mcpClient =>
    //                     mcpClient.getTools().find(t => t.name === toolCall.function.name)
    //                 );

    //                 if (mcp) {
    //                     console.log(`Calling tool: ${toolCall.function.name}`);
    //                     console.log("Arguments:", toolCall.function.arguments);

    //                     let args = {};
    //                     try {
    //                         args = JSON.parse(toolCall.function.arguments || "{}");
    //                     } catch (err) {
    //                         console.warn("Invalid JSON arguments, using empty object:", err);
    //                     }

    //                     const start = Date.now();
    //                     const result = await mcp.callTool(toolCall.function.name, args);
    //                     const elapsed = Date.now() - start;

    //                     console.log(`Result (${elapsed}ms): ${JSON.stringify(result).slice(0, 200)}...`);
    //                     this.llm.appendToolResult(toolCall.id, JSON.stringify(result));
    //                 } else {
    //                     console.warn(`Tool not found: ${toolCall.function.name}`);
    //                     this.llm.appendToolResult(toolCall.id, "Tool not found");
    //                 }
    //             }
    //         } else {
    //             break;
    //         }

    //         response = await this.llm.chat();
    //     }

    //     await this.close();
    //     return response?.content || "";
    // }
    public async invoke(prompt: string) {
        if (!this.llm) throw new Error("LLM not initialized");

        // Force English output for this call
        const finalPrompt = `${prompt}\n\nPlease respond in English only.`;

        let response = await this.llm.chat(finalPrompt);

        // Add safety loop limit (avoid infinite recursion)
        for (let i = 0; i < 10; i++) {
            if (response.toolCalls && response.toolCalls.length > 0) {
                for (const toolCall of response.toolCalls) {
                    const mcp = this.mcpClients.find(mcpClient =>
                        mcpClient.getTools().find(t => t.name === toolCall.function.name)
                    );

                    if (mcp) {
                        console.log(`Calling tool: ${toolCall.function.name}`);
                        console.log("Arguments:", toolCall.function.arguments);

                        let args = {};
                        try {
                            args = JSON.parse(toolCall.function.arguments || "{}");
                        } catch (err) {
                            console.warn("Invalid JSON arguments, using empty object:", err);
                        }

                        const start = Date.now();
                        const result = await mcp.callTool(toolCall.function.name, args);
                        const elapsed = Date.now() - start;

                        console.log(`Result (${elapsed}ms): ${JSON.stringify(result).slice(0, 200)}...`);

                        // Only surface the MCP tool output (content/structuredContent), not the wrapper
                        if (result && typeof result === "object" && "success" in result) {
                            const r: any = result as any;
                            if (r.success) {
                                this.llm.appendToolResult(
                                    toolCall.id,
                                    JSON.stringify(r.output ?? {})
                                );
                            } else {
                                this.llm.appendToolResult(
                                    toolCall.id,
                                    JSON.stringify({ error: r.error ?? "Tool call failed" })
                                );
                            }
                        } else {
                            // Fallback: append whatever came back
                            this.llm.appendToolResult(toolCall.id, JSON.stringify(result));
                        }
                    } else {
                        console.warn(`Tool not found: ${toolCall.function.name}`);
                        this.llm.appendToolResult(toolCall.id, "Tool not found");
                    }
                }
            } else {
                break;
            }

            // Follow-up chats will still respect systemPrompt (“English only”)
            response = await this.llm.chat();
        }

        await this.close();
        return response?.content || "";
    }

}
