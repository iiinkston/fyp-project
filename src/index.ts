// import ChatOpenAI from "./ChatOpenAI";
// import MCPClient from "./MCPClient";
// import Agent from "./agent";
// import path from "path";

// const currentDir = process.cwd();
// const outputFile = path.join(currentDir, "news.md");
// const fetchMcp = new MCPClient("fetch", "uvx", ["mcp-server-fetch"]);
// const fileMcp = new MCPClient("file", "npx", ["-y", "@modelcontextprotocol/server-filesystem", currentDir]);

// async function main() {
//     const agent = new Agent('gpt-4o-mini', [fetchMcp, fileMcp], "You are a helpful AI agent.", "");
//     await agent.init();
//     const response = await agent.invoke(`爬取 https://news.ycombinator.com/ 的内容并总结后保存到 ${outputFile}`);
//     console.log(response);
// }

// main().catch(console.error);
import ChatOpenAI from "./ChatOpenAI";
import MCPClient from "./MCPClient";
import Agent from "./Agent";
import path from "path";
import fs from "fs";

const currentDir = process.cwd();
const knowledgeDir = path.join(currentDir, "knowledge");

// Ensure the target folder exists
if (!fs.existsSync(knowledgeDir)) {
    fs.mkdirSync(knowledgeDir);
}

const fetchMcp = new MCPClient("fetch", "uvx", ["mcp-server-fetch"]);
const fileMcp = new MCPClient("file", "npx", ["-y", "@modelcontextprotocol/server-filesystem", currentDir]);

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


// Main execution
async function main() {
    const agent = new Agent("gpt-4o-mini", [fetchMcp, fileMcp], systemPrompt, "");
    await agent.init();

    const response = await agent.invoke(`
        使用 fetch 工具获取 https://jsonplaceholder.typicode.com/users 的完整 JSON 数据。
        
        然后根据每个用户的信息，在 ${knowledgeDir} 中为每个用户生成一个 Markdown 文件 (.md)，
        文件名使用 “用户名_姓氏” 格式（空格用下划线替代）。
        
        每个文件的内容格式如下：
        
        # {name}
        
        **ID**: {id}  
        **Username**: {username}  
        **Email**: {email}  
        **Address**:  
        - Street: {address.street}  
        - Suite: {address.suite}  
        - City: {address.city}  
        - Zipcode: {address.zipcode}  
        - Geo:  
          - Latitude: {address.geo.lat}  
          - Longitude: {address.geo.lng}  
        **Phone**: {phone}  
        **Website**: {website}  
        **Company**:  
        - Name: {company.name}  
        - Catch Phrase: {company.catchPhrase}  
        - BS: {company.bs}
        
        请严格保持以上 Markdown 格式，并将每个文件写入指定目录。
        `);


    console.log("\nFinal Response:\n", response);
}

main().catch(console.error);
