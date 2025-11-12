import ChatOpenAI from "./ChatOpenAI";
import MCPClient from "./MCPClient";
import Agent from "./Agent";
import path from "path";
import fs from "fs";
import EmbeddingRetrievers from "./embeddingRetrievers";
import { logTitle } from "./util";

const currentDir = process.cwd();
const knowledgeDir = path.join(currentDir, "knowledge");

// Ensure the knowledge directory exists
if (!fs.existsSync(knowledgeDir)) {
    fs.mkdirSync(knowledgeDir);
}

// MCP clients
const fetchMcp = new MCPClient("fetch", "uvx", ["mcp-server-fetch"]);
const fileMcp = new MCPClient("file", "npx", ["-y", "@modelcontextprotocol/server-filesystem", currentDir]);

// System prompt for GPT agent
const systemPrompt = `
You are an AI assistant with access to two tools:
1. "fetch" - retrieves online webpage or API content by URL.
   - It may return JSON data wrapped in a text field.
   - When the returned content type is JSON, parse it as an array or object.
2. "file" - reads and writes files to disk.
   - It accepts { "path": string, "content": string }.

When the user asks to get online JSON content (like from an API),
- Use the "fetch" tool only once to get the full response.
- Parse the JSON content.
- Then use the "file" tool to write the markdown text to the target path.

Never call "fetch" repeatedly unless a download fails.
Never call "list_allowed_directories" unless explicitly asked.
Stop after saving the file successfully.
`;

async function main() {
    const prompt = `Based on Bret's information, create a story about her and save it to ${currentDir}/Bret.md. The story should include her basic information and narrative.`;

    const context = await retrieveContext(prompt);

    const agent = new Agent("gpt-4o-mini", [fetchMcp, fileMcp], systemPrompt, context);
    await agent.init();

    const response = await agent.invoke(prompt);
    console.log(response);

    await agent.close();
}

async function retrieveContext(prompt: string): Promise<string> {
    const embeddingRetrievers = new EmbeddingRetrievers("BAAI/bge-m3");
    const files = fs.readdirSync(knowledgeDir);

    for (const file of files) {
        const content = fs.readFileSync(path.join(knowledgeDir, file), "utf-8");
        await embeddingRetrievers.embedDocument(content);
    }

    const contextItems = await embeddingRetrievers.retrieve(prompt);
    logTitle("CONTEXT");
    console.log(contextItems);

    return contextItems.map(item => item.document).join("\n\n");
}

main().catch(console.error);
