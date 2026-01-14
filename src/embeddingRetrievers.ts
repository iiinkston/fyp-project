import VectorStore from "./VectorStore.js";

interface OpenAIEmbeddingResponse {
    data: { embedding: number[] }[];
}

export default class EmbeddingRetrievers {
    private embeddingModel: string;
    private vectorStore: VectorStore;

    constructor(embeddingModel: string) {
        this.embeddingModel = embeddingModel;
        this.vectorStore = new VectorStore();
    }

    async embedQuery(query: string): Promise<number[]> {
        return await this.embed(query);
    }

    async embedDocument(document: string): Promise<number[]> {
        const embedding = await this.embed(document);
        this.vectorStore.addItem({ embedding, document });
        return embedding;
    }

    

    // Embed text using OpenAI
    private async embed(text: string): Promise<number[]> {
        const baseUrl = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
        const apiKey = process.env.OPENAI_API_KEY;
        

        if (!apiKey) throw new Error("OPENAI_API_KEY is missing in .env");

        const response = await fetch(`${baseUrl}/embeddings`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: this.embeddingModel, // e.g. "text-embedding-3-small"
                input: text,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch embeddings: ${errorText}`);
        }

        const data = (await response.json()) as OpenAIEmbeddingResponse;
        if (!data?.data?.[0]?.embedding) {
            throw new Error("Embedding response missing data[0].embedding");
        }
        return data.data[0].embedding;
    }

    async retrieve(query: string, topK: number = 3) {
        const queryEmbedding = await this.embedQuery(query);
        return this.vectorStore.search(queryEmbedding, topK);
    }
}
