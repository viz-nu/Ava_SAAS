import { encoding_for_model } from "tiktoken";
export const tokenSize = (model, txt) => {
    const enc = encoding_for_model(model);
    return enc.encode(txt).length;
}