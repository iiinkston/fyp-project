import VectorStore from "./Vectorstore";

export default class EmbeddingRetrievers {
    private embeddingModel: string;
    private vectorStore: VectorStore;

    constructor(embeddingModel: string) {
        this.embeddingModel = embeddingModel
        this.vectorStore = new VectorStore()
    }

    async embedQuery(query: string): Promise<number[]> {
        const embedding = await this.embed(query)
        return embedding
    }

    async embedDocument(document: string): Promise<number[]> {
        const embedding = await this.embed(document)
        this.vectorStore.addItem({
            embedding: await this.embed(document),
            document: document
        })
        return embedding
    }

    private async embed(document: string): Promise<number[]> {
        const response = await fetch('${process.env.EMBEDDING_BASE_URL}/embedding', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer${process.env.EMBEDDING_KEY}`
            },
            body: JSON.stringify({
                model: this.embeddingModel,
                input: document
            })
        })
        const data = await response.json()
        console.log(data.data[0].embedding)
        return data.data[0].embedding
    }

    async retrieve(query: string, topK: number = 3) {
        const queryEmbedding = await this.embedQuery(query)
        return this.vectorStore.search(queryEmbedding, topK)
    }
}