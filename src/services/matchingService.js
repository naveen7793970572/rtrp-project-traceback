import * as tf from '@tensorflow/tfjs'
import * as mobilenet from '@tensorflow-models/mobilenet'

let model = null

export async function loadModel() {
    if (!model) {
        model = await mobilenet.load({ version: 2, alpha: 0.5 })
    }
    return model
}

export async function extractEmbedding(imgElement) {
    const net = await loadModel()
    const embedding = net.infer(imgElement, true)
    const data = await embedding.data()
    embedding.dispose()
    return Array.from(data)
}

export function cosineSimilarity(a, b) {
    let dot = 0, normA = 0, normB = 0
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i]
        normA += a[i] * a[i]
        normB += b[i] * b[i]
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8)
}

export function calculateSemanticSimilarity(itemA, itemB) {
    let score = 0;
    
    // Category match (25%)
    if (itemA.category && itemA.category === itemB.category && itemA.category !== 'Other') score += 0.25;
    
    // Location match (15%)
    if (itemA.location && itemA.location === itemB.location && itemA.location !== 'Other') score += 0.15;
    
    // Time/Date proximity (20%)
    if (itemA.date && itemB.date) {
        const dateA = new Date(itemA.date);
        const dateB = new Date(itemB.date);
        const diffDays = Math.abs((dateA - dateB) / (1000 * 60 * 60 * 24));
        if (diffDays <= 1) score += 0.20;
        else if (diffDays <= 3) score += 0.10;
        else if (diffDays <= 7) score += 0.05;
    }
    
    // Text overlap (40%)
    const getWords = (text) => text ? text.toLowerCase().match(/\w+/g) || [] : [];
    const wordsA = new Set([...getWords(itemA.title), ...getWords(itemA.description)]);
    const wordsB = new Set([...getWords(itemB.title), ...getWords(itemB.description)]);
    
    const intersection = [...wordsA].filter(x => wordsB.has(x)).length;
    const union = new Set([...wordsA, ...wordsB]).size;
    const jaccard = union === 0 ? 0 : intersection / union;
    
    score += jaccard * 0.40; 
    return score;
}

export function findMatches(targetItem, candidates, topN = 5) {
    return candidates
        .map(c => {
            const hasImage = targetItem.embedding && targetItem.embedding.length > 0 && c.embedding && c.embedding.length > 0;
            const semanticScore = calculateSemanticSimilarity(targetItem, c);
            let finalScore = 0;

            if (hasImage) {
                const imageScore = cosineSimilarity(targetItem.embedding, c.embedding);
                finalScore = (imageScore * 0.6) + (semanticScore * 0.4);
            } else {
                // Rely heavily on semantics if images are missing. 
                finalScore = semanticScore * 2.0; 
            }

            return {
                ...c,
                score: Math.min(finalScore, 1.0), // Cap at 1.0 (100%)
            }
        })
        .filter(c => c.score > 0.35)
        .sort((a, b) => b.score - a.score)
        .slice(0, topN)
}
