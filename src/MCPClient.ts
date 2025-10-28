import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client";
import { Tool } from "@modelcontextprotocol/sdk/types.js";

export default class MCPClient {
    private mcp: Client;
    private transport: StdioClientTransport | null = null;
    private tools: Tool[] = [];
    private command: string;
    private args: string[];

    constructor(name: string, command: string,, args: string[], version?: string) {
        this.mcp = new Client({ name: name, version: "1.0.0" });
        this.command = command
        this.args = args
    }

    public async close() {
        await this.mcp.close()
    }

    public async init() {
        await this.connectToServer()
    }

    public getTools() {
        return this.tools
    }

    private async connectToServer() {
        try {
            this.transport = new StdioClientTransport({
                command: this.command,
                args: this.args,
            })
            await this.mcp.connect(this.transport);
            const toolsResult = await this.mcp.listTools();
            this.tools = toolsResult.tools.map((tool) => {
                return {
                    name: tool.name,
                    description: tool.description,
                    input_schema: tool.inputSchema
                };
            });
            console.log("Connected to server with tools:",
                this.tools.map(({ name }) => name)
            );
        } catch (e) {
            console.log("Failed to connect to MCP server:", e);
            throw e;
        }
    }
}  