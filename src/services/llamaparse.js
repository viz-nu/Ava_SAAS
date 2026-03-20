import LlamaCloud from '@llamaindex/llama-cloud';
class LlamaParser {
    constructor() {
        this.client = new LlamaCloud({ apiKey: process.env.LLAMA_PARSE_API_KEY });
    }
    buildWebhookUrl(baseUrl, params = {}) {
        const url = new URL(baseUrl);
        Object.entries(params).forEach(([key, value]) => {
            Array.isArray(value) ? value.forEach(v => url.searchParams.append(key, v)) : url.searchParams.append(key, value);
        });
        return url.toString();
    }
    async parse({ source_url, tier = 'cost_effective', version = 'latest', advancedOptions = {} }, queryOptions = {}) {
        const webhook_url = this.buildWebhookUrl("https://chat.avakado.ai/webhook/llamaparse", queryOptions);
        try {
            const parsing = await this.client.parsing.create({ tier, version, source_url,...advancedOptions, webhook_configurations: [{ webhook_headers: { 'Content-Type': 'application/json', 'X-custom-header': 'custom-value' }, webhook_url }] });
            return parsing;
        } catch (error) {
            console.error({ name: error.name, code: error.Code, message: error.message, metadata: error.$metadata });
            throw error;
        }
    }
    async get(parsingId, options = {}) {
        const parsingResponse = await this.client.parsing.get(parsingId, options);
        return parsingResponse;
    }
    async paginate(parsing) {
        const pages = Array.from({ length: (parsing.metadata?.pages?.length ?? 0) + 1 }, (_, index) => ({ page_number: index }));
        const assignPageContent = (key, fields = []) => {
            parsing[key]?.pages?.forEach((element) => {
                fields.forEach((field) => pages[element.page_number][field] = element.success === false ? null : element[field])
            })
        }
        const sources = { items: ["items"], markdown: ['markdown', 'header', 'footer'], metadata: ['confidence', 'cost_optimized', 'original_orientation_angle', 'printed_page_number', 'slide_section_name', 'speaker_notes', 'triggered_auto_mode'], text: ['text'] }
        Object.entries(sources).forEach(([key, fields]) => assignPageContent(key, fields));
        return pages;
    }
    async list() {
        const parsing = await this.client.parsing.list();
        return parsing;
    }
}

export const llamaParser = new LlamaParser();