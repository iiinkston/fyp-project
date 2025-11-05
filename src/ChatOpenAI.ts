import OpenAI from "openai";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import "dotenv/config";
import { logTitle } from "./util";

// Structure for tool call objects
export interface ToolCall {
    id: string;
    function: {
        name: string;
        arguments: string;
    };
}

export default class ChatOpenAI {
    private llm: OpenAI;
    private model: string;
    private messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    private tools: Tool[];

    constructor(
        model: string,
        systemPrompt: string = "",
        tools: Tool[] = [],
        context: string = ""
    ) {
        this.llm = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            baseURL: process.env.OPENAI_BASE_URL,
        });

        this.model = model;
        this.tools = tools;

        // Initialize chat messages
        if (systemPrompt) {
            this.messages.push({ role: "system", content: systemPrompt });
        }
        if (context) {
            this.messages.push({ role: "user", content: context });
        }
    }

    // Main chat logic - handles model response and tool calls
    async chat(prompt?: string) {
        logTitle("CHAT");

        if (prompt) {
            this.messages.push({ role: "user", content: prompt });
        }

        const completion = await this.llm.chat.completions.create({
            model: this.model,
            messages: this.messages,
            tools: this.getToolsDefinition(),
            tool_choice: "auto", // safe for OpenAI SDK ≥1.3.7
        });

        logTitle("RESPONSE");

        const choice = completion.choices[0];
        const message = choice.message!;

        const toolCalls: ToolCall[] = [];
        if (message.tool_calls && message.tool_calls.length > 0) {
            for (const call of message.tool_calls) {
                if (call.function) {
                    toolCalls.push({
                        id: call.id || "",
                        function: {
                            name: call.function.name || "",
                            arguments: call.function.arguments || "{}",
                        },
                    });
                }
            }
        }

        // Record model output
        this.messages.push({
            role: "assistant",
            content: message.content || "",
            tool_calls: message.tool_calls ?? [],
        });

        if (message.content) {
            process.stdout.write(`${message.content}\n`);
        }

        return {
            content: message.content || "",
            toolCalls,
        };
    }

    // Append tool result back to chat context
    public appendToolResult(toolCallId: string, toolOutput: string) {
        this.messages.push({
            role: "tool",
            tool_call_id: toolCallId,
            content: toolOutput,
        });
    }

    // Convert MCP tool definitions into OpenAI-compatible format
    private getToolsDefinition() {
        return this.tools.map((tool) => ({
            type: "function" as const,
            function: {
                name: tool.name,
                description: tool.description || "No description provided.",
                parameters: tool.inputSchema ?? {
                    type: "object",
                    properties: {},
                },
            },
        }));
    }
}
