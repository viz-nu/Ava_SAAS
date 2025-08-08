export const analyticsTypeDefs = `#graphql
  type Analytics {
    _id: ID!
    business: Business
    type: String
    data: JSON
    filters: JSON
    createdAt: DateTime
    updatedAt: DateTime
  }

  type Dashboard {
    _id: ID!
    name: String
    business: Business
    widgets: [Widget]
    layout: JSON
    isDefault: Boolean
    createdAt: DateTime
    updatedAt: DateTime
  }

  type Widget {
    _id: ID!
    type: String
    title: String
    config: JSON
    data: JSON
    position: Position
  }

  type Position {
    x: Int
    y: Int
    width: Int
    height: Int
  }

  type Report {
    _id: ID!
    name: String
    business: Business
    type: String
    filters: JSON
    data: JSON
    format: String
    schedule: Schedule
    createdAt: DateTime
    updatedAt: DateTime
  }

  type Schedule {
    frequency: String
    time: String
    dayOfWeek: Int
    dayOfMonth: Int
    isActive: Boolean
  }

  input AnalyticsInput {
    business: ID
    type: String
    data: JSON
    filters: JSON
  }

  input DashboardInput {
    name: String!
    business: ID
    widgets: [WidgetInput]
    layout: JSON
    isDefault: Boolean
  }

  input WidgetInput {
    type: String!
    title: String!
    config: JSON
    position: PositionInput
  }

  input PositionInput {
    x: Int
    y: Int
    width: Int
    height: Int
  }

  input ReportInput {
    name: String!
    business: ID
    type: String
    filters: JSON
    format: String
    schedule: ScheduleInput
  }

  input ScheduleInput {
    frequency: String
    time: String
    dayOfWeek: Int
    dayOfMonth: Int
    isActive: Boolean
  }

  type Query {
    # Get analytics data
    analytics(
      businessId: ID
      type: String
      filters: JSON
      from: DateTime
      to: DateTime
    ): [Analytics] @requireScope(scope: "analytics:read") @requireBusinessAccess

    # Get dashboard
    dashboard(id: ID): Dashboard @requireScope(scope: "analytics:read") @requireBusinessAccess

    # Get user's dashboards
    dashboards(businessId: ID): [Dashboard] @requireScope(scope: "analytics:read") @requireBusinessAccess

    # Get reports
    reports(
      businessId: ID
      type: String
      isActive: Boolean
    ): [Report] @requireScope(scope: "analytics:read") @requireBusinessAccess

    # Get specific report
    report(id: ID!): Report @requireScope(scope: "analytics:read") @requireResourceOwnership(model: "Report", idField: "id")

    # Export analytics data
    exportAnalytics(
      businessId: ID
      type: String
      format: String
      filters: JSON
    ): String @requireScope(scope: "analytics:export") @requireBusinessAccess

    # Get real-time analytics
    realTimeAnalytics(
      businessId: ID
      type: String
    ): JSON @requireScope(scope: "analytics:real_time") @requireBusinessAccess
  }

  type Mutation {
    # Create custom report
    createReport(report: ReportInput!): Report @requireScope(scope: "analytics:custom_reports") @requireBusinessAccess

    # Update report
    updateReport(id: ID!, report: ReportInput!): Report @requireScope(scope: "analytics:custom_reports") @requireResourceOwnership(model: "Report", idField: "id")

    # Delete report
    deleteReport(id: ID!): Boolean @requireScope(scope: "analytics:custom_reports") @requireResourceOwnership(model: "Report", idField: "id")

    # Create dashboard
    createDashboard(dashboard: DashboardInput!): Dashboard @requireScope(scope: "analytics:read") @requireBusinessAccess

    # Update dashboard
    updateDashboard(id: ID!, dashboard: DashboardInput!): Dashboard @requireScope(scope: "analytics:read") @requireResourceOwnership(model: "Dashboard", idField: "id")

    # Delete dashboard
    deleteDashboard(id: ID!): Boolean @requireScope(scope: "analytics:read") @requireResourceOwnership(model: "Dashboard", idField: "id")

    # Schedule report generation
    scheduleReport(reportId: ID!, schedule: ScheduleInput!): Report @requireScope(scope: "analytics:custom_reports") @requireResourceOwnership(model: "Report", idField: "reportId")
  }
`; 