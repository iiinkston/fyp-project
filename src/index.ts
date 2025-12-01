import path from "path";
import fs from "fs";
import MCPClient from "./MCPClient.js";
import Agent from "./Agent.js";
import EmbeddingRetrievers from "./embeddingRetrievers.js";
import { logTitle } from "./util.js";
import "dotenv/config";


// ====== CONFIG ======
const currentDir = process.cwd();
const knowledgeDir = path.join(currentDir, "knowledge");

// Ensure knowledge directory exists
if (!fs.existsSync(knowledgeDir)) {
    fs.mkdirSync(knowledgeDir);
}

// ====== MCP CLIENTS ======

// 1. Real-time stock tool (MCP server: node mcp-stock-server.js)
const stockMcpClient = new MCPClient(
    "stock-server",
    "node",
    ["mcp-stock-server.js"]
);

// 2. Fetch tool
const fetchMcp = new MCPClient(
    "fetch",
    "uvx",
    ["mcp-server-fetch"]
);

// 3. File system tool
const fileMcp = new MCPClient(
    "file",
    "npx",
    ["-y", "@modelcontextprotocol/server-filesystem", currentDir]
);

// ====== SYSTEM PROMPT ======
const systemPrompt = `
You are an AI assistant with multiple tools:
1. "get_stock_quote" — real-time stock data from Finnhub.
2. "fetch" — fetch online JSON or text from a URL.
3. "file" — read/write file content to disk.

General RULES:
- Always respond in English only.
- Never use Chinese or any other language unless the user explicitly asks.
- Keep responses clear, concise, and accurate.
- When tools return data, summarize it in English.
- When RAG context contains other languages, ignore the language and respond in English only.
`;

// ====== RETRIEVAL ======
async function retrieveContext(prompt: string): Promise<string> {
    const embeddingRetrievers = new EmbeddingRetrievers("BAAI/bge-m3");

    const files = fs.readdirSync(knowledgeDir);
    for (const file of files) {
        const content = fs.readFileSync(path.join(knowledgeDir, file), "utf-8");
        await embeddingRetrievers.embedDocument(content);
    }

    const contextItems = await embeddingRetrievers.retrieve(prompt);

    logTitle("CONTEXT (RAG Retrieved)");
    console.log(contextItems);

    return contextItems.map(i => i.document).join("\n\n");
}

// ====== MAIN ======
async function main() {

    // Example prompt 1: 股票查询
    const prompt1 = "please search Tesla stock market price and give me a summary.";

    // Build context (可选)
    const context1 = await retrieveContext(prompt1);

    const agent1 = new Agent(
        "gpt-4.1-mini",
        [stockMcpClient],         // Only stock tool for this agent
        systemPrompt,
        context1
    );

    await agent1.init();
    const result1 = await agent1.invoke(prompt1);

    console.log("=== result ===");
    console.log(result1);
}

main().catch(console.error);
