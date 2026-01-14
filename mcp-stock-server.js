#!/usr/bin/env node
import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import fetch from "node-fetch";
import { z } from "zod";

// 1. 创建 MCP 服务器
const server = new McpServer({
    name: "stock-server",
    version: "0.1.0",
});

// 2. 注册工具：get_stock_quote
server.registerTool(
    "get_stock_quote",
    {
        title: "Get real-time stock quote",
        description: "Fetch real-time quote from Finnhub for a given stock symbol",
        // Use Zod schema; SDK will convert to JSON Schema for clients
        inputSchema: z.object({
            symbol: z.string().describe("Ticker symbol, e.g. AAPL, TSLA, 700.HK"),
        }),
    },
    // handler：真正调用 Finnhub
    async ({ symbol }) => {
        const apiKey = process.env.FINNHUB_API_KEY;
        if (!apiKey) {
            const msg = "FINNHUB_API_KEY not set in environment variables.";
            return {
                content: [{ type: "text", text: msg }],
            };
        }

        const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(
            symbol
        )}&token=${apiKey}`;

        try {
            const res = await fetch(url);
            if (!res.ok) {
                const msg = `HTTP error from Finnhub: ${res.status} ${res.statusText}`;
                return {
                    content: [{ type: "text", text: msg }],
                };
            }

            const d = await res.json();

            const msg =
                `Quote for ${symbol}: ` +
                `current=${d.c}, high=${d.h}, low=${d.l}, open=${d.o}, prevClose=${d.pc}`;

            return {
                content: [{ type: "text", text: msg }],
                // 你也可以顺便返回结构化数据（可选）
                structuredContent: {
                    symbol,
                    current: d.c,
                    high: d.h,
                    low: d.l,
                    open: d.o,
                    prevClose: d.pc,
                    raw: d,
                },
            };
        } catch (err) {
            const msg = "Error fetching data: " + (err?.message || String(err));
            return {
                content: [{ type: "text", text: msg }],
            };
        }
    }
);

// 3. 用 stdio 启动 MCP 服务器
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch((err) => {
    console.error("Failed to start MCP stock-server:", err);
    process.exit(1);
});
