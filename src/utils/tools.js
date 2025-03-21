export const populateStructure = (child, dataMap, parentPath = "") => {
    const result = []
    if (child.dataType == "object") child.childSchema.forEach(ele => result.push(...populateStructure(ele, dataMap, parentPath + "/" + child.key)))
    else {
        if (child.userDefined) {
            const obj = { ...child, fieldPath: parentPath + "/" + child.key }
            const value = dataMap.get(child.label);
            if (value !== undefined) obj.data = value || null;
            result.push(obj)
        }
    }
    return result
}