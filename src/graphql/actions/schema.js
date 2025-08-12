export const actionTypeDefs = `#graphql
  type Action {
    _id: ID!
    name: String
    description: String 
    business: Business
    async: Boolean
    needsApproval: Boolean
    parameters: JSON
    functionString: String
    errorFunction: String
    UI: JSON
    isPublic: Boolean
    createdAt: DateTime
    updatedAt: DateTime
  }
  input ActionInput {
    name: String!
    description: String
    async: Boolean
    needsApproval: Boolean
    parameters: JSON
    functionString: String
    errorFunction: String
    UI: JSON
    isPublic: Boolean
  }
  type Query {
    # Get all actions for the user's business
    actions(id:ID limit: Int isPublic: Boolean): [Action] @requireScope(scope: "action:read") @requireBusinessAccess
  }

  type Mutation {
    # Create a new action
    createAction(action: ActionInput!): Action @requireScope(scope: "action:create") @requireBusinessAccess

    # Update an existing action
    updateAction(id: ID! action: ActionInput!): Action @requireScope(scope: "action:update")  @requireBusinessAccess

    # Delete an action
    deleteAction(id: ID!): Boolean @requireScope(scope: "action:delete") @requireBusinessAccess
  }
`; 