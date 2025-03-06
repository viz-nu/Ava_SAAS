import { removeStopwords } from 'stopword';
import natural from 'natural';
const { TfIdf } = natural;
function preprocess(query) {
    // Convert to lowercase
    let tokens = query.toLowerCase().match(/[a-zA-Z0-9%]+/g) || [];

    // Remove stopwords
    tokens = removeStopwords(tokens);

    return tokens;
}
export const analyzeQueries = (queries) => {
    // Preprocess queries and tokenize
    let queriesTokens = queries.map(query => preprocess(query));

    // Step 1: Keyword Extraction using TF-IDF
    let corpus = queriesTokens.map(tokens => tokens.join(' '));
    let tfidf = new TfIdf();
    corpus.forEach(doc => tfidf.addDocument(doc));

    let wordScores = {};
    tfidf.documents.forEach((doc, docIndex) => {
        Object.keys(doc).forEach(term => {
            if (!wordScores[term]) {
                wordScores[term] = 0;
            }
            wordScores[term] += tfidf.tfidf(term, docIndex);
        });
    });

    let sortedWords = Object.entries(wordScores)
        .map(([word, score]) => ({ word, score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);

    // Step 2: Keyword Frequency Analysis
    let allTokens = queriesTokens.flat();
    let tokenCounts = allTokens.reduce((acc, token) => {
        acc[token] = (acc[token] || 0) + 1;
        return acc;
    }, {});

    let mostCommonTokens = Object.entries(tokenCounts)
        .filter(([_, count]) => count > 1)
        .map(([word, count]) => ({ word, count }))
        .sort((a, b) => b.count - a.count);

    return {
        top_keywords: mostCommonTokens
    };
}