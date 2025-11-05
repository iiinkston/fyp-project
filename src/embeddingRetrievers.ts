import VectorStore from "./VectorStore";

// 定义嵌入 API 返回结构
interface EmbeddingAPIResponse {
    data: { embedding: number[] }[];
}

export default class EmbeddingRetrievers {
    private embeddingModel: string;
    private vectorStore: VectorStore;

    constructor(embeddingModel: string) {
        this.embeddingModel = embeddingModel;
        this.vectorStore = new VectorStore();
    }

    // 将用户查询转为嵌入向量
    async embedQuery(query: string): Promise<number[]> {
        return await this.embed(query);
    }

    // 嵌入文档，并存入向量数据库
    async embedDocument(document: string): Promise<number[]> {
        const embedding = await this.embed(document);
        this.vectorStore.addItem({ embedding, document });
        return embedding;
    }

    // 嵌入文本，向 SiliconFlow 发送请求
    private async embed(text: string): Promise<number[]> {
        const baseUrl = process.env.EMBEDDING_BASE_URL;
        const apiKey = process.env.EMBEDDING_KEY;

        if (!baseUrl) throw new Error("❌ EMBEDDING_BASE_URL is missing in .env");
        if (!apiKey) throw new Error("❌ EMBEDDING_KEY is missing in .env");

        const response = await fetch(`${baseUrl}/embeddings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: this.embeddingModel,
                input: text,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`❌ Failed to fetch embeddings: ${errorText}`);
        }

        const data = (await response.json()) as EmbeddingAPIResponse;
        return data.data[0].embedding;
    }

    // 返回语义相似文档（topK 个）
    async retrieve(query: string, topK: number = 3) {
        const queryEmbedding = await this.embedQuery(query);
        return this.vectorStore.search(queryEmbedding, topK);
    }
}
