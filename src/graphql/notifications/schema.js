export const notificationTypeDefs = `#graphql
"""Status of a notification"""
enum statusEnum {
  """Notification has not been viewed"""
  unseen
  """Notification has been viewed"""
  seen
}

"""Input type for updating notification status"""
input statusUpdateInput {
    """ID of notification to update"""
    id: ID!
    """New status to set"""
    status: statusEnum
}

"""Represents a notification sent to a user"""
type notification {
    """Unique identifier"""
    _id: ID
    """Title/header of the notification"""
    head: String
    """Main notification message content"""
    body: String
    """Category/classification of notification"""
    type: String
    """Additional data associated with notification"""
    attachments: JSON
    """Current viewed status"""
    status: statusEnum
    """Creation timestamp"""
    createdAt: DateTime
    """Last update timestamp"""
    updatedAt: DateTime
}

type Query {
    """Get all notifications for the current user"""
    fetchNotifications: [notification] @requireScope(scope: "notification:read")
}

type Mutation {
  """Update status of a notification
  @param statusUpdateInput - Contains notification ID and new status"""
  updateNotifications(statusUpdateInput: statusUpdateInput!): notification @requireScope(scope: "notification:update") @requireBusinessAccess

  """Delete a notification
  @param id - ID of notification to delete"""
  deleteNotifications(id: ID!): Boolean @requireScope(scope: "notification:delete") @requireBusinessAccess
}
`;