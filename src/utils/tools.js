export const populateBodyStructure = (bodyStructure, input) => {
    // Create a map for quick lookup by label
    const dataMap = new Map();
    input.dataSchema.forEach(item => { dataMap.set(item.label, item.data) });
    // Helper function to update nested fields
    function updateField(field) {
        // Handle fields with childSchema (nested objects)
        if (field.childSchema && Array.isArray(field.childSchema)) {
            field.childSchema = field.childSchema.map(childField => updateField(childField));
            return field;
        }
        // Handle non-nested fields
        const value = dataMap.get(field.label);
        if (value !== undefined) field.data = value;
        return field;
    }

    // Process and return the updated structure
    return bodyStructure.map(field => updateField(field));
}