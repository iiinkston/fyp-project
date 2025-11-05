export interface VectorStoreItem {
    embedding: number[];
    document: string;
}

export default class VectorStore {
    private vectorStore: VectorStoreItem[];

    constructor() {
        this.vectorStore = [];
    }

    // Add one item (embedding + document) into the store
    async addItem(item: VectorStoreItem) {
        this.vectorStore.push(item);
    }

    // Search topK most similar documents given a query embedding
    async search(queryEmbedding: number[], topK: number = 3) {
        if (this.vectorStore.length === 0) return [];

        const scored = this.vectorStore.map(item => ({
            document: item.document,
            score: this.cosineSim(item.embedding, queryEmbedding)
        }));

        return scored
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
    }

    // Compute cosine similarity between two vectors
    private cosineSim(v1: number[], v2: number[]) {
        if (v1.length !== v2.length) {
            throw new Error("Vector dimensions do not match");
        }

        const dotProduct = v1.reduce((acc, val, index) => acc + val * v2[index], 0);
        const magnitude1 = Math.sqrt(v1.reduce((acc, val) => acc + val * val, 0));
        const magnitude2 = Math.sqrt(v2.reduce((acc, val) => acc + val * val, 0));

        if (magnitude1 === 0 || magnitude2 === 0) return 0;
        return dotProduct / (magnitude1 * magnitude2);
    }
}
