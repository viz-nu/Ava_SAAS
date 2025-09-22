import { calculateCost } from "./openai.js"

export const CostCalculator = ({ knowledgeTokensRes, existingKnowledgeCosts, type, AnalysisTokensRes, existingAnalysisCosts, chatTokens, existingChatCosts }) => {
    let result
    switch (type) {
        case "knowledge":
            result = existingKnowledgeCosts
            for (const ele of knowledgeTokensRes) {
                existingKnowledgeCosts.totalEmbeddingTokens += ele.totalEmbeddingTokens
                existingKnowledgeCosts.TotalSummarizationInputTokens += ele.TotalSummarizationInputTokens
                existingKnowledgeCosts.TotalSummarizationOutputTokens += ele.TotalSummarizationOutputTokens
                existingKnowledgeCosts.TotalSummarizationTotalTokens += ele.TotalSummarizationTotalTokens
                let kt = calculateCost("text-embedding-3-small", ele.totalEmbeddingTokens, 0)
                let st = calculateCost("gpt-4o-mini", ele.TotalSummarizationInputTokens, ele.TotalSummarizationOutputTokens)
                existingKnowledgeCosts.OverAllKnowledgeCost += (kt.totalCost + st.totalCost)
            }
            break;
        case "analysis":
            result = existingAnalysisCosts
            for (const ele of AnalysisTokensRes) {
                if (ele._id == null) continue;
                // Add token counts
                existingAnalysisCosts.totalAnalysisTokensUsed += Number(ele.TotalAnalysisTotalTokens);
                // Get computed costs
                const { inputCost, outputCost, totalCost } = calculateCost(ele._id, ele.TotalAnalysisInputTokens, ele.TotalAnalysisOutputTokens) || {};
                // Accumulate cost fields properly
                existingAnalysisCosts.costOfInputAnalysisTokens += inputCost;
                existingAnalysisCosts.costOfOutputAnalysisTokens += outputCost;
                existingAnalysisCosts.OverAllAnalysisCost += totalCost;
            }
            break;
        case "chat":
            result = existingChatCosts
            for (const ele of chatTokens) {
                if (ele._id == null) continue;
                // Add token counts
                existingChatCosts.totalChatTokensUsed += Number(ele.totalChatTokensUsed);
                // Get computed costs
                const { inputCost, outputCost, totalCost } = calculateCost(ele._id, ele.inputChatTokensUsed, ele.outputChatTokensUsed) || {};
                // Accumulate cost fields properly
                existingChatCosts.costOfInputChatTokens += inputCost;
                existingChatCosts.costOfOutputChatTokens += outputCost;
                existingChatCosts.OverAllChatCost += totalCost;
            }
            break;
        default:
            console.log("Invalid type")
            return null
            break;
    }
    return result

}