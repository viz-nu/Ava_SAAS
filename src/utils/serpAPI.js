import axios from 'axios';
import { OpenAiLLM } from './openai.js';
// TAVILY_API_KEY
const tavilyApiKey = "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";

export const searchBusiness = async (businessName) => {
    try {
        // Using Tavily API to get search results
        const response = await axios.post('https://api.tavily.com/search', {
            query: `${businessName} official website, tagline, facts, address, phone, about(description), information, FAQ`,
            search_depth: "advanced",
            include_answer: false,
            include_domains: [],
            exclude_domains: [],
            max_results: 10,
            api_key: tavilyApiKey
        });

        // Tavily response format is different from SERP API
        const results = response.data.results || [];
        // Transform results to a similar format for easier processing
        return results.map(result => ({
            title: result.title || '',
            snippet: result.content || '',
            link: result.url || ''
        }));
    } catch (error) {
        console.error('Error searching for business:', error.message);
        if (axios.isAxiosError(error)) {
            console.error('Error status:', error.response?.status);
            console.error('Error fetching tokens:', error.response?.data || error.message);
        } else {
            console.error('Unexpected error:', error);
        }
        throw new Error('Failed to search for business information');
    }
}
/**
 * Extract relevant content from search results
 * @param {Array} searchResults - The search results
 * @returns {string} - Concatenated relevant text
 */
export const extractRelevantContent = (searchResults) => {
    // Extract snippets and titles from search results
    const relevantText = searchResults.map(result => {
        return `${result.title || ''}. ${result.snippet || ''}`;
    }).join('\n\n');

    return relevantText;
}
import { z } from "zod";
export const BusinessExtraction = z.object({
    facts: z.array(z.string()).describe("List of interesting facts about the business"),
    faqs: z.array(z.string()).describe("List of FAQs"),
    tagline: z.string().describe("Tagline of the business"),
    description: z.string().describe("Description of the business"),
    address: z.string().describe("Address of the business"),
    website: z.string().describe("Website of the business"),
    phone: z.string().describe("Phone number of the business")
});
import { zodTextFormat } from "openai/helpers/zod";
export const generateFactsAndFAQs = async (businessName, content) => {
    try {
        const factsAndFaqs = await OpenAiLLM({
            model: "gpt-4o-mini",
            input: [
                {
                    role: "system",
                    content: "Extract business information and format it as structured data."
                },
                {
                    role: "user",
                    content: `Based on the following information about "${businessName}", extract:
            1. Some interesting and factual points about the business, minimum 6.
            2. Some frequently asked questions that potential customers might have, minimum 6.
            Information about ${businessName}:
            ${content}`
                }
            ],
            text: {
                format: zodTextFormat(BusinessExtraction, "business_extraction"),
            }
        })
        console.log("parsed facts and faqs", JSON.stringify(factsAndFaqs, null, 2));
        return factsAndFaqs;
    } catch (error) {
        console.error('Error generating facts and FAQs:', error.message);
        throw new Error('Failed to generate facts and FAQs');
    }
}
export const getBusinessInfo = async (businessName) => {
    try {
        console.log(`Getting information for: ${businessName}`);
        // Step 1: Search for the business website and relevant information
        const searchResults = await searchBusiness(businessName);

        // Step 2: Extract relevant text content from search results
        const relevantContent = extractRelevantContent(searchResults);

        // Step 3: Use OpenAI to generate facts and FAQs from the content
        const { facts, faqs, tagline, description, address, website, phone } = await generateFactsAndFAQs(businessName, relevantContent);

        return {
            facts,
            "frequently asked questions": faqs,
            tagline, description, address, website, phone
        };
    } catch (error) {
        console.error('Error getting business information:', error.message);
        return {
            facts: [],
            "frequently asked questions": [],
            error: error.message
        };
    }
}