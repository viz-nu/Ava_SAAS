import { model, Schema } from 'mongoose';
const ApiSchema = new Schema({
    provider: { type: Schema.Types.ObjectId, ref: 'Providers' },
    title: String,
    description: String,
    version: String,
    schemas: {
        input: Schema.Types.Mixed,
        config: Schema.Types.Mixed,
        output: Schema.Types.Mixed,
        error: Schema.Types.Mixed,
        auth: { type: String, enum: ['oauth2', 'apiKey', 'basic', 'bearer', 'jwt', 'hmac', 'customHeader', 'mtls', 'cookie', 'none'] }
    },
    requestTemplate: {
        method: String,
        url: {
            base: String,
            path: String,
            params: Schema.Types.Mixed
        },
        headers: Schema.Types.Mixed,
        body: Schema.Types.Mixed
    },
    requiredScopes: [String]
}, { timestamps: true });

ApiSchema.methods.evaluateExpressions = function (context = { input, config }) {
    const EXPR_REGEX = /\{\{\{([\s\S]*?)\}\}\}|\{\{([\s\S]*?)\}\}/g;

    function evalExpression(expr) {
        try {
            const fn = new Function(
                "input",
                "config",
                "context",
                `return (${expr})`
            );
            return fn(context.input, context.config, context);
        } catch (err) {
            console.error("Expression error:", expr, err);
            return undefined;
        }
    }

    function process(value) {
        if (typeof value === "string") {
            const matches = [...value.matchAll(EXPR_REGEX)];
            //entire string is a single expression → return real type
            if (
                matches.length === 1 &&
                matches[0][0].length === value.length
            ) {
                const expr = matches[0][1] || matches[0][2];
                return evalExpression(expr);
            }

            //string with mixed content → interpolate
            return value.replace(EXPR_REGEX, (_, expr1, expr2) => {
                const result = evalExpression(expr1 || expr2);

                if (result === undefined || result === null) return "";
                if (typeof result === "object") return JSON.stringify(result);

                return String(result);
            });
        }

        //Array
        if (Array.isArray(value)) {
            return value.map(process);
        }

        // Object
        if (typeof value === "object" && value !== null) {
            const result = {};
            for (const key in value) {
                result[key] = process(value[key]);
            }
            return result;
        }

        // Pimitive (number, boolean, etc.)
        return value;
    }

    return process(this.requestTemplate);
};

// { method: String, url: { base: String, path: String, params: object }, headers: object, body: object }
const ProvidersSchema = new Schema({
    name: String,
    description: String,
    icon: String, // url
    color: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'Users' }
}, { timestamps: true });

export const Api = model('Api', ApiSchema, 'Api');
export const Providers = model('Providers', ProvidersSchema, 'Providers');


// const apis = await Api.aggregate([
//     {
//       $lookup: {
//         from: 'Providers',
//         localField: 'provider',
//         foreignField: '_id',
//         as: 'provider'
//       }
//     },
//     { $unwind: '$provider' },
//     {
//       $match: {
//         'provider.name': 'Stripe'
//       }
//     }
//   ]);


