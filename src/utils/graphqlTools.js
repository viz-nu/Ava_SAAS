export const flattenFields = (fields, prefix = '', result = {}) => {
    for (const key in fields) {
        if (key === '__typename') continue; // Apollo adds this; ignore it

        const path = prefix ? `${prefix}.${key}` : key;
        const value = fields[key];

        if (!value || typeof value !== 'object' || Object.keys(value).length === 0) {
            result[path] = 1;
        } else {
            flattenFields(value, path, result);
        }
    }
    return result;
}