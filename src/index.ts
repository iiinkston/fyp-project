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

// 1) Market data tools (OpenBB; MCP server: node mcp-openbb-server.js)
const openbbMcpClient = new MCPClient("openbb-server", "node", ["mcp-openbb-server.js"]);

// Optional legacy Finnhub quote tool (fallback, not primary).
// Only enabled when USE_LEGACY_FINNHUB=true is set in the environment.
const useLegacyFinnhub = process.env.USE_LEGACY_FINNHUB === "true";
const legacyFinnhubMcpClient = useLegacyFinnhub
    ? new MCPClient("legacy-finnhub", "node", ["mcp-stock-server.js"])
    : null;

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
You are an AI assistant with multiple tools for market data and retrieval:
1. "equity_quote" — real-time equity quote via OpenBB (default provider: yfinance).
2. "equity_price_historical" — historical OHLCV equity prices via OpenBB (default provider: yfinance).
3. "equity_search" — search for equities by symbol or name via OpenBB.
4. "fetch" — fetch online JSON or text from a URL.
5. "file" — read/write file content to disk.

Provider strategy:
- Prefer free providers by default: use "yfinance" first.
- For historical data, you may retry once with "stooq" as a free fallback if "yfinance" fails.
- For quotes, you may retry once with a supported paid provider (e.g. "fmp" or "tradier") if "yfinance" fails; do NOT use "stooq" for quotes.

Tool usage contract:
- Always specify the "provider" argument explicitly on every market data tool call (typically "yfinance"; you may use "stooq" as a fallback).
- For historical data ("equity_price_historical"), always specify appropriate date ranges (start_date and end_date) and an interval (e.g. "1d").
- Expect tool responses to include "structuredContent" with normalized keys plus a "raw" field containing the provider-specific payload.
- When you receive historical OHLCV rows, explicitly compute and cite numerical metrics such as: start_close, end_close, percent change over the window, max and min daily returns, largest gap up/down (open vs previous close), and a simple volatility proxy (standard deviation of daily returns) based strictly on the returned rows.
- Do not invent prices or returns; if data is missing, say so instead of guessing.
- In your final answers, always cite the symbol and provider used, and clearly distinguish between real-time quotes and historical data.

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
    const prompt1 =
        "For A-share stock 600519.SH (Kweichow Moutai), retrieve the real-time quote and the last 30 trading days of daily OHLCV data.Summarize the price trend, percentage change, and volatility.Use provider yfinance.";

    // Build context
    const context1 = await retrieveContext(prompt1);

    const mcpClients = [
        openbbMcpClient,
        fetchMcp,
        fileMcp,
        ...(legacyFinnhubMcpClient ? [legacyFinnhubMcpClient] : []),
    ];

    const agent1 = new Agent("gpt-4.1-mini", mcpClients, systemPrompt, context1);

    await agent1.init();
    const result1 = await agent1.invoke(prompt1);

    console.log("=== result ===");
    console.log(result1);
}

main().catch(console.error);
