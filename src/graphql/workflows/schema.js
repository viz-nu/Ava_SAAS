export const workflowTypeDefs = `#graphql
    type Workflow {
        _id: ID!
        name: String
        nodes: JSON
        connections: JSON
        business: Business
        createdBy: User
        status: String
        createdAt: DateTime
        updatedAt: DateTime
    }
    type WorkflowConnection {
        data: [Workflow]
        metaData: WorkflowPaginationMetaData
    }
    type WorkflowPaginationMetaData {
        page: Int
        limit: Int
        totalPages: Int
        totalDocuments: Int
    }
    type InbuiltNodeConnection {
        data: [InbuiltNode]
        metaData: InbuiltNodePaginationMetaData
    }
    type InbuiltNodePaginationMetaData {
        page: Int
        limit: Int
        totalPages: Int
        totalDocuments: Int
    }
    type InbuiltNode {
        _id: ID!
        id: String
        ports: JSON
        core: JSON
        meta: JSON
        createdBy: User
        createdAt: DateTime
        updatedAt: DateTime
    }
type Query {
fetchWorkflows(id: ID, limit: Int, page: Int): WorkflowConnection @requireScope(scope: "workflow:read") @requireBusinessAccess
fetchInbuiltNodes(label: String, type: String, templateType: String, id: ID, limit: Int, page: Int): InbuiltNodeConnection @requireScope(scope: "workflow:read") @requireBusinessAccess
}
type Mutation {
    createWorkflow(name: String, nodes: JSON, connections: JSON): Workflow @requireScope(scope: "workflow:create") @requireBusinessAccess
    updateWorkflow(id: ID!, name: String, nodes: JSON, connections: JSON): Workflow @requireScope(scope: "workflow:update") @requireBusinessAccess
    deleteWorkflow(id: ID!): Boolean @requireScope(scope: "workflow:delete") @requireBusinessAccess
    testWorkflowNode(input: JSON, node: JSON): JSON @requireScope(scope: "workflow:create") @requireBusinessAccess
    createInbuiltNode(id: ID, ports: JSON, core: JSON, meta: JSON): InbuiltNode @requireScope(scope: "workflow:create") 
    updateInbuiltNode(id: ID, ports: JSON, core: JSON, meta: JSON): InbuiltNode @requireScope(scope: "workflow:update") 
    deleteInbuiltNode(id: ID!): Boolean @requireScope(scope: "workflow:delete") 
}
`;