function buildGraph(connections) {
    const graph = {};
    Object.values(connections).forEach(({ from, to }) => {
        const fromNode = from.split("/")[0];
        const toNode = to.split("/")[0];
        if (!graph[fromNode]) graph[fromNode] = [];
        graph[fromNode].push(toNode);
    });
    return graph;
}
function hasCycle(graph) {
    const visited = new Set();
    const inStack = new Set();
    function dfs(node) {
        // Node is already in current recursion path → cycle
        if (inStack.has(node)) return true;
        // Already fully explored → no cycle from here
        if (visited.has(node)) return false;
        visited.add(node);
        inStack.add(node);
        const neighbors = graph[node] || [];
        for (const next of neighbors) {
            if (dfs(next)) return true;
        }
        inStack.delete(node);
        return false;
    }
    for (const node of Object.keys(graph)) {
        if (dfs(node)) return true;
    }
    return false;
}
export const validateLoops = (workflow) => {
    const graph = buildGraph(workflow.connections);
    return hasCycle(graph);
}
