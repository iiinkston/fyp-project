import dotenv from "dotenv";
import chalk from "chalk";
import OpenAI from "openai";

dotenv.config();

export function logTitle(message: string) {
    const totalLength = 80;
    const padding = Math.max(0, totalLength - message.length - 4);
    const padded = `${"=".repeat(Math.floor(padding / 2))} ${message} ${"=".repeat(Math.ceil(padding / 2))}`;
    console.log(chalk.bold.cyanBright(padded));
}

async function main() {
    logTitle("Testing OpenAI Connection");

    const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL,
    });

    const response = await client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "Hello from ts-node!" }],
    });

    console.log(chalk.green("Response:"), response.choices[0].message?.content);
}

main().catch(console.error);
