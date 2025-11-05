// import ChatOpenAI from "./ChatOpenAI";
// import MCPClient from "./MCPClient";
// import { logTitle } from "./util"; // make sure util.ts exports logTitle

// export default class Agent {
//     private mcpClients: MCPClient[];
//     private llm: ChatOpenAI | null = null;
//     private model: string;
//     private systemPrompt: string;
//     private context: string;

//     constructor(model: string, mcpClients: MCPClient[], systemPrompt: string, context: string) {
//         this.mcpClients = mcpClients;
//         this.model = model;
//         this.systemPrompt = systemPrompt;
//         this.context = context;
//     }

//     // Initialize the LLM and all MCP clients
//     public async init() {
//         // collect all tools from MCP clients
//         const allTools = this.mcpClients.flatMap(c => c.getTools());
//         this.llm = new ChatOpenAI(this.model, allTools, this.systemPrompt, this.context);

//         for (const mcpClient of this.mcpClients) {
//             await mcpClient.init();
//         }
//     }


//     // Close all MCP clients
//     public async close() {
//         logTitle("CLOSE MY CLIENTS");
//         for (const client of this.mcpClients) {
//             await client.close();
//         }
//     }

//     // Main agent logic: handle chat → tool calls → tool results → repeat
//     public async invoke(prompt: string) {
//         if (!this.llm) throw new Error("LLM not initialized");

//         let response = await this.llm.chat(prompt);

//         // Keep looping until the model stops producing tool calls
//         while (true) {
//             // If there are tool calls, execute them
//             if (response.toolCalls && response.toolCalls.length > 0) {
//                 for (const toolCall of response.toolCalls) {
//                     // Find the MCP client that has the requested tool
//                     const mcp = this.mcpClients.find(mcpClient =>
//                         mcpClient.getTools().find(t => t.name === toolCall.function.name)
//                     );

//                     if (mcp) {
//                         console.log(`Calling tool: ${toolCall.function.name}`);
//                         console.log("Arguments:", toolCall.function.arguments);

//                         const args = JSON.parse(toolCall.function.arguments || "{}");
//                         const result = await mcp.callTool(toolCall.function.name, args);

//                         console.log(`Result: ${JSON.stringify(result)}`);
//                         this.llm.appendToolResult(toolCall.id, JSON.stringify(result));
//                     } else {
//                         this.llm.appendToolResult(toolCall.id, "Tool not found");
//                     }
//                 }
//             } else {
//                 // No more tool calls — conversation likely finished
//                 break;
//             }

//             // Continue conversation with new tool results
//             response = await this.llm.chat();
//         }

//         // Close clients and return final content
//         await this.close();
//         return response.content;
//     }
// }
import ChatOpenAI from "./ChatOpenAI";
import MCPClient from "./MCPClient";
import { logTitle } from "./util";

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
    public async invoke(prompt: string) {
        if (!this.llm) throw new Error("LLM not initialized");

        let response = await this.llm.chat(prompt);

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
                        this.llm.appendToolResult(toolCall.id, JSON.stringify(result));
                    } else {
                        console.warn(`Tool not found: ${toolCall.function.name}`);
                        this.llm.appendToolResult(toolCall.id, "Tool not found");
                    }
                }
            } else {
                break;
            }

            response = await this.llm.chat();
        }

        await this.close();
        return response?.content || "";
    }
}
