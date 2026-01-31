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
type Query {
fetchWorkflows(id: ID, limit: Int, page: Int): WorkflowConnection @requireScope(scope: "workflow:read") @requireBusinessAccess
}
type Mutation {
    createWorkflow(name: String, nodes: JSON, connections: JSON): Workflow @requireScope(scope: "workflow:create") @requireBusinessAccess
    updateWorkflow(id: ID!, name: String, nodes: JSON, connections: JSON): Workflow @requireScope(scope: "workflow:update") @requireBusinessAccess
    deleteWorkflow(id: ID!): Boolean @requireScope(scope: "workflow:delete") @requireBusinessAccess
    testWorkflowNode(input: JSON, node: JSON): JSON @requireScope(scope: "workflow:create") @requireBusinessAccess
}
`;