// index.ts
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

// 1) Real-time stock tool (MCP server: node mcp-stock-server.js)
const stockMcpClient = new MCPClient("stock-server", "node", ["mcp-stock-server.js"]);

// 2) Fetch tool
const fetchMcp = new MCPClient("fetch", "uvx", ["mcp-server-fetch"]);

// 3) File system tool
const fileMcp = new MCPClient("file", "npx", [
    "-y",
    "@modelcontextprotocol/server-filesystem",
    currentDir,
]);

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

// ====== RETRIEVAL (BUILD INDEX ONCE) ======
// IMPORTANT:
// - Use OpenAI embedding model name (embeddingRetrievers.ts should call OpenAI /embeddings).
// - Build the knowledge index only once per process run (avoid re-embedding every query).

const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const embeddingRetrievers = new EmbeddingRetrievers(embeddingModel);

let indexed = false;

async function buildIndexOnce(): Promise<void> {
    if (indexed) return;

    const files = fs.readdirSync(knowledgeDir);

    for (const file of files) {
        const fullPath = path.join(knowledgeDir, file);

        // Skip non-files (folders) just in case
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) continue;

        const content = fs.readFileSync(fullPath, "utf-8").trim();
        if (!content) continue;

        await embeddingRetrievers.embedDocument(content);
    }

    indexed = true;
}

async function retrieveContext(prompt: string): Promise<string> {
    await buildIndexOnce();

    const contextItems = await embeddingRetrievers.retrieve(prompt);

    logTitle("CONTEXT (RAG Retrieved)");
    console.log(contextItems);

    return contextItems.map((i) => i.document).join("\n\n");
}

// ====== MAIN ======
async function main() {
    // prompt 1: Stock Lookup
    const prompt1 = "How about Nvidia,how's its stock performance recently?";

    // Build context
    const context1 = await retrieveContext(prompt1);

    const agent1 = new Agent(
        "gpt-4.1-mini",
        [stockMcpClient], // Only stock tool for this agent
        systemPrompt,
        context1
    );

    await agent1.init();
    const result1 = await agent1.invoke(prompt1);

    console.log("=== result ===");
    console.log(result1);
}

main().catch(console.error);
