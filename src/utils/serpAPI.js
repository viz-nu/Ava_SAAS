import axios from 'axios';
import { OpenAiLLM } from './openai.js';
// TAVILY_API_KEY
const tavilyApiKey = "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";
const BUSINESS_SECTORS = [
    "Agriculture & Natural Resources",
    "Manufacturing & Industrial",
    "Construction & Infrastructure",
    "Energy & Utilities",
    "Retail & Consumer Goods",
    "Transportation & Logistics",
    "Hospitality & Tourism",
    "Food & Beverage",
    "Healthcare & Wellness",
    "Education & Training",
    "Finance & Insurance",
    "Real Estate & Property",
    "Legal & Professional Services",
    "Media & Entertainment",
    "Technology & Software",
    "E-commerce & Digital Services",
    "Government & Public Services",
    "Nonprofits & NGOs",
    "Research & Development",
    "Creative & Design Services"
];
export const searchBusiness = async (businessName) => {
    try {
        // Using Tavily API to get search results
        const response = await axios.post('https://api.tavily.com/search', {
            query: `${businessName} official website, tagline, facts, address, phone, about(description), information, FAQ, industry, sector, business type, category, services, products`,
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
            console.error('Error at searchBusiness:', error.response?.data || error.message);
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
    phone: z.string().describe("Phone number of the business"),
    sector: z.enum(BUSINESS_SECTORS).describe("The most relevant business sector from the provided list")
});
import { zodTextFormat } from "openai/helpers/zod";
export const generateFactsAndFAQs = async (businessName, content) => {
    try {
        const factsAndFaqs = await OpenAiLLM({
            model: "gpt-4o-mini",
            input: [
                {
                    role: "system",
                    content: `Extract business information and format it as structured data. 
                    
                    For the sector field, choose the most appropriate sector from this list:
                    ${BUSINESS_SECTORS.map((sector, index) => `${index + 1}. ${sector}`).join('\n')}
                    
                    Select only ONE sector that best represents the primary business activity.`
                },
                {
                    role: "user",
                    content: `Based on the following information about "${businessName}", extract:
            1. Some interesting and factual points about the business, minimum 6.
            2. Some frequently asked questions that potential customers might have, minimum 6.
            3. The most relevant business sector from the provided list.
            
            Information about ${businessName}:
            ${content}`
                }
            ],
            text: {
                format: zodTextFormat(BusinessExtraction, "business_extraction"),
            }
        })
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
        const { facts, faqs, tagline, description, address, website, phone, sector } = await generateFactsAndFAQs(businessName, relevantContent);

        return {
            facts,
            "frequently asked questions": faqs,
            tagline,
            description,
            address,
            website,
            phone,
            sector
        };
    } catch (error) {
        console.error('Error getting business information:', error.message);
        return {
            facts: [],
            "frequently asked questions": [],
            tagline: "",
            description: "",
            address: "",
            website: "",
            phone: "",
            sector: "",
            error: error.message
        };
    }
}