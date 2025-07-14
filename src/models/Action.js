import { model, Schema } from 'mongoose';
const ActionSchema = new Schema({
    name: String,
    business: { type: { type: Schema.Types.ObjectId, ref: 'Businesses' }, default: "" },
    async: { type: Boolean, default: true },
    name: String,
    description: String,
    needsApproval: Boolean, // Knowledge fetching doesn't need approval
    parameters: Schema.Types.Mixed,
    functionString: String,
    errorFunction: String,
    UI: Schema.Types.Mixed,
    isPublic: { type: Boolean, default: false },
}, {
    timestamps: true
});
export const Action = model('Action', ActionSchema, "Action");



// const searchKnowledgeBaseAction = {
//   name: "search_knowledge_base",
//   async: true,
//   description: "Searches the knowledge base using a query and optional source filters.",
//   needsApproval: false,
//   parameters: {
//     dataType: "object",
//     dataFormat: undefined,
//     isRequired: true,
//     key: "parameters",
//     validation: null,
//     description: "Object with required fields query and options.",
//     properties: new Map([
//       [
//         "query",
//         {
//           type: "string",
//           description: "The text-based search query to retrieve relevant information from the documentation."
//         }
//       ],
//       [
//         "options",
//         {
//           type: "object",
//           description: "Additional search parameters such as filtering by source cluster IDs."
//         }
//       ]
//     ]),
//     additionalProperties: false,
//     label: "Search Knowledge Base Parameters"
//   },
//   functionString: `
//     if (!input.query || !input.options.source || !Array.isArray(input.options.source)) {
//         throw new Error('Both "query" (string) and "source" (array) are required parameters');
//     }
//     if (input.query.trim().length < 3) {
//         throw new Error('Query must be at least 3 characters long');
//     }
//     if (input.options.source.length < 1) {
//         throw new Error('Source array must have at least one collection');
//     }
//     const params = new URLSearchParams({
//         query: input.query,
//         collections: JSON.stringify(input.options.source)
//     });
//     const response = await fetch('https://chatapi.campusroot.com/fetch-from-db?' + params.toString(), {
//         method: 'POST',
//         headers: {
//             'Content-Type': 'application/json'
//         }
//     });
//     const data = await response.json();
//     if (!data.success) {
//         throw new Error(data.message || 'Knowledge base fetch failed');
//     }
//     return \`Answer from the knowledge base for query: "\${input.query}"\\n\\n\${data.data}\`;
//   `,
//   errorFunction: `
//     console.error('Knowledge fetch failed with input:', input);
//     return 'I couldn\\'t retrieve the requested information. Please check your query and source. If the issue persists, try again later.';
//   `,
//   UI: null 
// };




// "async": true,
//     "name": "search_knowledge_base",
//         "description": "Searches the knowledge base using a query and optional source filters.",
//             "parameters": {
//     "type": "object",
//         "properties": {
//         "query": {
//             "type": "string",
//                 "description": "The text-based search query to retrieve relevant information from the documentation."
//         },
//         "options": {
//             "type": "object",
//                 "description": "Additional search parameters such as filtering by source cluster IDs.",
//                     "properties": {
//                 "source": {
//                     "type": "array",
//                         "description": "Array of knowledge base cluster IDs to narrow the search scope.",
//                             "items": {
//                         "type": "string"
//                     },
//                     "default": [
//                         "6861d92d860c3c61902aaf11"
//                     ]
//                 }
//             },
//             "required": [
//                 "source"
//             ],
//                 "additionalProperties": false
//         }
//     },
//     "required": [
//         "query",
//         "options"
//     ],
//         "additionalProperties": false
// },
// "needsApproval": false,
//     "functionString": "\n    if (!input.query || !input.options.source || !Array.isArray(input.options.source)) {\n        throw new Error('Both \"query\" (string) and \"source\" (array) are required parameters');\n    }\n    if (input.query.trim().length < 3) {\n        throw new Error('Query must be at least 3 characters long');\n    }\n    if (input.options.source.length < 1) {\n        throw new Error('Source array must have at least one collection');\n    }\n    const params = new URLSearchParams({\n        query: input.query,\n        collections: JSON.stringify(input.options.source)\n    });\n    const response = await fetch('https://chatapi.campusroot.com/fetch-from-db?' + params.toString(), {\n        method: 'POST',\n        headers: {\n            'Content-Type': 'application/json'\n        }\n    });\n    const data = await response.json();\n    if (!data.success) {\n        throw new Error(data.message || 'Knowledge base fetch failed');\n    }\n    return Answer from the knowledge base for query: \"${input.query}\"\\n\\n${data.data};\n",
//         "errorFunction": "\n    console.error('Knowledge fetch failed with input:', input);\n    return 'I couldn\\'t retrieve the requested information. Please check your query and source. If the issue persists, try again later.';\n"
