import { mapSchema, getDirective, MapperKind } from '@graphql-tools/utils';
import { defaultFieldResolver, GraphQLError } from 'graphql';
import { Models } from "../../models/index.js"
/**
 * GraphQL Directives for Scope-Based Authorization
 */

// Directive definitions
export const scopeAuthDirectiveTypeDefs = `#graphql
  directive @requireScope(scope: String!) on FIELD_DEFINITION
  directive @requireAnyScope(scopes: [String!]!) on FIELD_DEFINITION
  directive @requireAllScopes(scopes: [String!]!) on FIELD_DEFINITION
  directive @requireBusinessAccess on FIELD_DEFINITION
  directive @requireResourceOwnership(model: String!, idField: String, ownerField: String,creatorIndependent:Boolean) on FIELD_DEFINITION
`;

// Scope requirement directive
export function requireScopeDirectiveTransformer(schema) {
    return mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
            const requireScopeDirective = getDirective(schema, fieldConfig, 'requireScope')?.[0];

            if (requireScopeDirective) {
                const { scope } = requireScopeDirective;
                const { resolve = defaultFieldResolver } = fieldConfig;
                fieldConfig.resolve = async (source, args, context, info) => {
                    // Check if user is authenticated
                    if (!context.user) {
                        throw new GraphQLError('Authentication required', {
                            extensions: { code: 'UNAUTHENTICATED' }
                        });
                    }
                    // Check if user has required scope
                    if (!context.user.hasScope(scope)) {
                        throw new GraphQLError(`Insufficient permissions. Required scope: ${scope}`, {
                            extensions: { code: 'FORBIDDEN', requiredScope: scope }
                        });
                    }

                    return resolve(source, args, context, info);
                };
            }

            return fieldConfig;
        }
    });
}

// Any scope requirement directive
export function requireAnyScopeDirectiveTransformer(schema) {
    return mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
            const requireAnyScopeDirective = getDirective(schema, fieldConfig, 'requireAnyScope')?.[0];

            if (requireAnyScopeDirective) {
                const { scopes } = requireAnyScopeDirective;
                const { resolve = defaultFieldResolver } = fieldConfig;

                fieldConfig.resolve = async (source, args, context, info) => {
                    // Check if user is authenticated
                    if (!context.user) {
                        throw new GraphQLError('Authentication required', {
                            extensions: { code: 'UNAUTHENTICATED' }
                        });
                    }

                    // Check if user has any of the required scopes
                    if (!context.user.hasAnyScope(scopes)) {
                        throw new GraphQLError(`Insufficient permissions. Required one of: ${scopes.join(', ')}`, {
                            extensions: { code: 'FORBIDDEN', requiredScopes: scopes }
                        });
                    }

                    return resolve(source, args, context, info);
                };
            }

            return fieldConfig;
        }
    });
}

// All scopes requirement directive
export function requireAllScopesDirectiveTransformer(schema) {
    return mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
            const requireAllScopesDirective = getDirective(schema, fieldConfig, 'requireAllScopes')?.[0];

            if (requireAllScopesDirective) {
                const { scopes } = requireAllScopesDirective;
                const { resolve = defaultFieldResolver } = fieldConfig;

                fieldConfig.resolve = async (source, args, context, info) => {
                    // Check if user is authenticated
                    if (!context.user) {
                        throw new GraphQLError('Authentication required', {
                            extensions: { code: 'UNAUTHENTICATED' }
                        });
                    }

                    // Check if user has all required scopes
                    if (!context.user.hasAllScopes(scopes)) {
                        throw new GraphQLError(`Insufficient permissions. Required all: ${scopes.join(', ')}`, {
                            extensions: { code: 'FORBIDDEN', requiredScopes: scopes }
                        });
                    }

                    return resolve(source, args, context, info);
                };
            }

            return fieldConfig;
        }
    });
}

// Business access requirement directive
export function requireBusinessAccessDirectiveTransformer(schema) {
    return mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
            const requireBusinessAccessDirective = getDirective(schema, fieldConfig, 'requireBusinessAccess')?.[0];

            if (requireBusinessAccessDirective) {
                const { resolve = defaultFieldResolver } = fieldConfig;

                fieldConfig.resolve = async (source, args, context, info) => {
                    // Check if user is authenticated
                    if (!context.user) {
                        throw new GraphQLError('Authentication required', {
                            extensions: { code: 'UNAUTHENTICATED' }
                        });
                    }

                    // Super admins can access all businesses
                    if (context.user.role === 'superAdmin') {
                        return resolve(source, args, context, info);
                    }

                    // Check if user has business access
                    if (!context.user.business) {
                        throw new GraphQLError('Business access required', {
                            extensions: { code: 'FORBIDDEN' }
                        });
                    }

                    return resolve(source, args, context, info);
                };
            }

            return fieldConfig;
        }
    });
}

// Resource ownership requirement directive
export function requireResourceOwnershipDirectiveTransformer(schema) {
    return mapSchema(schema, {
        [MapperKind.OBJECT_FIELD]: (fieldConfig) => {
            const requireResourceOwnershipDirective = getDirective(schema, fieldConfig, 'requireResourceOwnership')?.[0];

            if (requireResourceOwnershipDirective) {
                const { model, idField = 'id', ownerField = 'createdBy', creatorIndependent = false } = requireResourceOwnershipDirective;
                const { resolve = defaultFieldResolver } = fieldConfig;

                fieldConfig.resolve = async (source, args, context, info) => {
                    // Check if user is authenticated
                    if (!context.user) {
                        throw new GraphQLError('Authentication required', {
                            extensions: { code: 'UNAUTHENTICATED' }
                        });
                    }

                    // Super admins can access all resources
                    if (context.user.role === 'superAdmin') {
                        return resolve(source, args, context, info);
                    }
                    // Get resource ID from arguments
                    const resourceId = args[idField];

                    if (!resourceId) {
                        throw new GraphQLError(`Resource ID required in field: ${idField}`, {
                            extensions: { code: 'BAD_USER_INPUT' }
                        });
                    }

                    try {
                        // Import the model dynamically
                        if (!Models[model]) {
                            throw new GraphQLError(`Model "${model}" not found in registry`, {
                                extensions: { code: 'INTERNAL_SERVER_ERROR' }
                            });
                        }
                        const resource = await Models[model].findById(resourceId);

                        if (!resource) {
                            throw new GraphQLError('Resource not found', {
                                extensions: { code: 'NOT_FOUND' }
                            });
                        }
                        // Check if user owns the resource or belongs to the same business
                        if (!creatorIndependent) {
                            console.log("creator id dependent here")
                            if (resource[ownerField] && resource[ownerField].toString() === context.user._id.toString()) {
                                return resolve(source, args, context, info);
                            }
                        }
                        else { console.log("creator is independent here") }

                        // Check business access if resource has business field
                        if (resource.business && context.user.business &&
                            resource.business.toString() === context.user.business.toString()) {
                            return resolve(source, args, context, info);
                        }

                        throw new GraphQLError('Access denied to this resource', {
                            extensions: { code: 'FORBIDDEN' }
                        });

                    } catch (error) {
                        console.error(error);

                        if (error instanceof GraphQLError) {
                            throw error;
                        }
                        throw new GraphQLError('Internal server error', {
                            extensions: { code: 'INTERNAL_SERVER_ERROR' }
                        });
                    }
                };
            }

            return fieldConfig;
        }
    });
}


// Combine all directive transformers
export function applyScopeAuthDirectives(schema) {
    let transformedSchema = schema;

    transformedSchema = requireScopeDirectiveTransformer(transformedSchema);
    transformedSchema = requireAnyScopeDirectiveTransformer(transformedSchema);
    transformedSchema = requireAllScopesDirectiveTransformer(transformedSchema);
    transformedSchema = requireBusinessAccessDirectiveTransformer(transformedSchema);
    transformedSchema = requireResourceOwnershipDirectiveTransformer(transformedSchema);

    return transformedSchema;
} 