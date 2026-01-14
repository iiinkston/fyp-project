// import dotenv from "dotenv";
// import chalk from "chalk";
// import OpenAI from "openai";

// dotenv.config();

// export function logTitle(message: string) {
//     const totalLength = 80;
//     const padding = Math.max(0, totalLength - message.length - 4);
//     const padded = `${"=".repeat(Math.floor(padding / 2))} ${message} ${"=".repeat(Math.ceil(padding / 2))}`;
//     console.log(chalk.bold.cyanBright(padded));
// }

// async function main() {
//     logTitle("Testing OpenAI Connection");

//     const client = new OpenAI({
//         apiKey: process.env.OPENAI_API_KEY,
//         baseURL: process.env.OPENAI_BASE_URL,
//     });

//     const response = await client.chat.completions.create({
//         model: "gpt-3.5-turbo",
//         messages: [{ role: "user", content: "Hello from ts-node!" }],
//     });

//     console.log(chalk.green("Response:"), response.choices[0].message?.content);
// }

// main().catch(console.error);

export function logTitle(title: string) {
    console.log(`\n=========================== ${title.toUpperCase()} ===========================`);
}

// Simple metrics helper for OHLCV rows returned by equity_price_historical.
// rows: Array<{ date: string, open: number | null, high: number | null, low: number | null, close: number | null, volume: number | null }>
export function computeOHLCVMetrics(rows: Array<{
    date: string;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    volume: number | null;
}>) {
    if (!rows || rows.length === 0) {
        return {
            start_close: null,
            end_close: null,
            pct_change: null,
            max_daily_return: null,
            min_daily_return: null,
            max_gap_up: null,
            max_gap_down: null,
            volatility: null,
            count: 0,
        };
    }

    const closes = rows.map(r => r.close).filter((c): c is number => c != null);
    const firstClose = closes.length > 0 ? closes[0] : null;
    const lastClose = closes.length > 0 ? closes[closes.length - 1] : null;

    let pctChange: number | null = null;
    if (firstClose != null && lastClose != null && firstClose !== 0) {
        pctChange = (lastClose / firstClose - 1) * 100;
    }

    const dailyReturns: number[] = [];
    let maxDailyReturn: number | null = null;
    let minDailyReturn: number | null = null;

    let maxGapUp: number | null = null;
    let maxGapDown: number | null = null;

    let prevClose: number | null = null;

    for (const row of rows) {
        if (prevClose != null && row.close != null && prevClose !== 0) {
            const ret = row.close / prevClose - 1;
            dailyReturns.push(ret);
            if (maxDailyReturn === null || ret > maxDailyReturn) {
                maxDailyReturn = ret;
            }
            if (minDailyReturn === null || ret < minDailyReturn) {
                minDailyReturn = ret;
            }
        }

        if (prevClose != null && row.open != null && prevClose !== 0) {
            const gap = row.open / prevClose - 1;
            if (gap > 0) {
                if (maxGapUp === null || gap > maxGapUp) {
                    maxGapUp = gap;
                }
            } else if (gap < 0) {
                if (maxGapDown === null || gap < maxGapDown) {
                    maxGapDown = gap;
                }
            }
        }

        if (row.close != null) {
            prevClose = row.close;
        }
    }

    let volatility: number | null = null;
    if (dailyReturns.length > 1) {
        const mean =
            dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
        const variance =
            dailyReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) /
            (dailyReturns.length - 1);
        volatility = Math.sqrt(variance);
    }

    return {
        start_close: firstClose,
        end_close: lastClose,
        pct_change: pctChange,
        max_daily_return: maxDailyReturn,
        min_daily_return: minDailyReturn,
        max_gap_up: maxGapUp,
        max_gap_down: maxGapDown,
        volatility,
        count: rows.length,
    };
}
