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
