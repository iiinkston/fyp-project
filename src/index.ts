import ChatOpenAI from "./ChatOpenAI";

async function main() {
    const llm = new ChatOpenAI('gpt-4o-mini')
    const { content, toolCalls } = await llm.chat('Hello')
    console.log(content)
    console.log(toolCalls)
}

main()