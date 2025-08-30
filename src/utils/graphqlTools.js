// export const flattenFields = (fields, prefix = '', result = {}) => {
//     for (const key in fields) {
//         if (key === '__typename') continue; // Apollo adds this; ignore it

//         const path = prefix ? `${prefix}.${key}` : key;
//         const value = fields[key];

//         if (!value || typeof value !== 'object' || Object.keys(value).length === 0) {
//             result[path] = 1;
//         } else {
//             flattenFields(value, path, result);
//         }
//     }
//     return result;
// }
// export const flattenFields = (fields, prefix = '', result = { projection: {}, nested: {} }) => {
//     for (const key in fields) {
//         if (key === '__typename') continue;

//         const path = prefix ? `${prefix}.${key}` : key;
//         const value = fields[key];

//         if (value && typeof value === 'object' && Object.keys(value).length > 0) {
//             // recurse into children
//             flattenFields(value, path, result);

//             // also collect sub-selection for populate
//             const [parent, child] = path.split('.', 2);
//             if (!result.nested[parent]) result.nested[parent] = {};
//             result.nested[parent][path.replace(`${parent}.`, '')] = 1;
//         } else {
//             // leaf field → add to projection
//             result.projection[path] = 1;

//             // if it's nested, add to nested map too
//             if (path.includes('.')) {
//                 const [parent, child] = path.split('.', 2);
//                 if (!result.nested[parent]) result.nested[parent] = {};
//                 result.nested[parent][child] = 1;
//             }
//         }
//     }
//     return result;
// };

export const flattenFields = (fields, prefix = '', result = { projection: {}, nested: {} }) => {
    for (const key in fields) {
      if (key === '__typename') continue;
  
      const path = prefix ? `${prefix}.${key}` : key;
      const value = fields[key];
  
      if (value && typeof value === 'object' && Object.keys(value).length > 0) {
        // This is a nested object (like business or createdBy)
        const parent = path.split('.')[0]; // top-level parent (business, createdBy, etc.)
  
        // ensure parent is in projection (ONLY once)
        result.projection[parent] = 1;
  
        // ensure nested map exists
        if (!result.nested[parent]) result.nested[parent] = {};
  
        // recurse deeper, but ONLY collect nested children → not projection
        flattenFields(value, path, result);
      } else {
        // This is a leaf field
        if (path.includes('.')) {
          // belongs to a nested relation → save in nested map
          const [parent, child] = path.split('.', 2);
          if (!result.nested[parent]) result.nested[parent] = {};
          result.nested[parent][child] = 1;
        } else {
          // top-level scalar → safe for projection
          result.projection[path] = 1;
        }
      }
    }
    return result;
  };

