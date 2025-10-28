import OpenAI from "openai";
import { Tool } from "@modelcontextprotocol/sdk/types.js";
import "dotenv/config";
import { logTitle } from "./util";

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

        if (systemPrompt)
            this.messages.push({ role: "system", content: systemPrompt });
        if (context) this.messages.push({ role: "user", content: context });
    }

    async chat(prompt?: string) {
        logTitle("CHAT");
        if (prompt) this.messages.push({ role: "user", content: prompt });

        const stream = await this.llm.chat.completions.create({
            model: this.model,
            messages: this.messages,
            stream: true,
            tools: this.getToolsDefinition(),
        });

        let content = "";
        let toolCalls: ToolCall[] = [];
        logTitle("RESPONSE");

        for await (const chunk of stream) {
            const delta = chunk.choices[0].delta;

            if (delta.content) {
                const contentChunk = delta.content || "";
                content += contentChunk;
                process.stdout.write(contentChunk);
            }

            if (delta.tool_calls) {
                for (const toolCallChunk of delta.tool_calls) {
                    if (toolCalls.length <= toolCallChunk.index) {
                        toolCalls.push({ id: "", function: { name: "", arguments: "" } });
                    }
                    const currentCall = toolCalls[toolCallChunk.index];
                    if (toolCallChunk.id) currentCall.id += toolCallChunk.id;
                    if (toolCallChunk.function?.name)
                        currentCall.function.name += toolCallChunk.function.name;
                    if (toolCallChunk.function?.arguments)
                        currentCall.function.arguments += toolCallChunk.function.arguments;
                }
            }
        }

        this.messages.push({
            role: "assistant",
            content,
            tool_calls: toolCalls.map((call) => ({
                type: "function",
                id: call.id,
                function: call.function,
            })),
        });

        return { content, toolCalls };
    }

    public appendToolResult(toolCallId: string, toolOutput: string) {
        this.messages.push({
            role: "tool",
            tool_call_id: toolCallId,
            content: toolOutput,
        });
    }

    private getToolsDefinition() {
        return this.tools.map((tool) => ({
            type: "function" as const,
            function: tool,
        }));
    }
}
