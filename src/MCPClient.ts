// import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
// import { Client } from "@modelcontextprotocol/sdk/client";
// import { Tool } from "@modelcontextprotocol/sdk/types.js";

// export default class MCPClient {
//     private mcp: Client;
//     private transport: StdioClientTransport | null = null;
//     private tools: Tool[] = [];
//     private command: string;
//     private args: string[];

//     constructor(name: string, command: string, args: string[], version?: string) {
//         // Initialize the MCP client with a name and version
//         this.mcp = new Client({ name, version: version ?? "1.0.0" });
//         this.command = command;
//         this.args = args;
//     }

//     // Gracefully close the MCP connection
//     public async close() {
//         try {
//             await this.mcp.close();
//         } catch (err) {
//             console.warn("Error closing MCP client:", err);
//         }
//     }

//     // Initialize the connection and load tools
//     public async init() {
//         await this.connectToServer();
//     }

//     // Return all available tools for this MCP instance
//     public getTools() {
//         return this.tools;
//     }

//     // Call a specific tool by name, passing parameters as a JS object
//     public async callTool(name: string, params: Record<string, any>) {
//         try {
//             const result = await this.mcp.callTool({ name, arguments: params });
//             return result;
//         } catch (err) {
//             console.error(`Error calling tool "${name}":`, err);
//             return { error: String(err) };
//         }
//     }

//     // Establishes the MCP server connection and loads its available tools
//     private async connectToServer() {
//         try {
//             // Create a new stdio transport for this MCP process
//             this.transport = new StdioClientTransport({
//                 command: this.command,
//                 args: this.args,
//             });

//             // Connect the client to the MCP server
//             await this.mcp.connect(this.transport);

//             // Retrieve available tools from the server
//             const toolsResult = await this.mcp.listTools();

//             // Normalize tool schema names to a consistent structure
//             this.tools = toolsResult.tools.map((tool) => ({
//                 name: tool.name,
//                 description: tool.description,
//                 inputSchema: tool.inputSchema,
//             }));

//             console.log(
//                 "Connected to MCP server with tools:",
//                 this.tools.map(({ name }) => name)
//             );
//         } catch (err) {
//             console.error("Failed to connect to MCP server:", err);
//             throw err;
//         }
//     }
// }
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

export interface ToolResponse {
    success?: boolean;
    output?: any;
    error?: string;
}

export default class MCPClient {
    private mcp: Client;
    private transport: StdioClientTransport | null = null;
    private tools: Tool[] = [];
    private command: string;
    private args: string[];

    constructor(name: string, command: string, args: string[], version?: string) {
        this.mcp = new Client({ name, version: version ?? "1.0.0" });
        this.command = command;
        this.args = args;
    }

    // Gracefully close the MCP connection
    public async close() {
        try {
            await this.mcp.close();
        } catch (err) {
            console.warn("Error closing MCP client:", err);
        }
    }

    // Initialize connection and load tools
    public async init() {
        await this.connectToServer();
    }

    // Return all available tools
    public getTools() {
        return this.tools;
    }

    // Call a specific tool by name with parameters
    public async callTool(name: string, params: Record<string, any>): Promise<ToolResponse> {
        try {
            const result = await this.mcp.callTool({ name, arguments: params });
            return { success: true, output: result };
        } catch (err) {
            console.error(`Error calling tool "${name}":`, err);
            return { success: false, error: String(err) };
        }
    }

    // Establish connection to MCP server and list tools
    private async connectToServer() {
        try {
            console.log(`Connecting to MCP server: ${this.command} ${this.args.join(" ")}`);

            this.transport = new StdioClientTransport({
                command: this.command,
                args: this.args,
            });

            await this.mcp.connect(this.transport);

            const toolsResult = await this.mcp.listTools();

            // Normalize tool schemas and ensure safety
            this.tools = toolsResult.tools.map((tool) => ({
                name: tool.name,
                description: tool.description || "No description provided",
                inputSchema: tool.inputSchema ?? { type: "object", properties: {} },
            }));

            console.log(
                "Connected to MCP server with tools:",
                this.tools.map(({ name }) => name)
            );
        } catch (err) {
            console.error("Failed to connect to MCP server:", err);
            this.transport = null; // prevent dangling transport
            throw err;
        }
    }
}
