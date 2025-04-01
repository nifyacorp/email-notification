# NIFYA Email Notification Service Architecture

## System Overview

```
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
|  Notification    |     |    PubSub        |     |  Email           |
|  Worker          +---->+    Service       +---->+  Notification    |
|                  |     |                  |     |  Service         |
+------------------+     +------------------+     +--------+---------+
                                                           |
                                                           v
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
|  User            |     |  Database        |     |  Gmail           |
|  Preferences     +---->+  (PostgreSQL)    |     |  SMTP Server     |
|                  |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
```

## Data Flow

```
┌─────────────────┐     ┌───────────────────┐     ┌─────────────────┐
│ 1. Notification │     │ 2. Notification   │     │ 3. Email        │
│    Creation     │────>│    Publication    │────>│    Delivery     │
└─────────────────┘     └───────────────────┘     └─────────────────┘
      │                        │                         │
      │                        │                         │
      ▼                        ▼                         ▼
┌─────────────────┐     ┌───────────────────┐     ┌─────────────────┐
│ Database Write  │     │ Message Routing   │     │ Template        │
│                 │     │ (Immediate/Daily) │     │ Rendering       │
└─────────────────┘     └───────────────────┘     └─────────────────┘
```

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ Email Notification Service                                       │
│                                                                 │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐    │
│  │               │    │               │    │               │    │
│  │  Express      │    │  PubSub       │    │  Email        │    │
│  │  Server       │    │  Subscribers  │    │  Sender       │    │
│  │               │    │               │    │               │    │
│  └───────┬───────┘    └───────┬───────┘    └───────┬───────┘    │
│          │                    │                    │            │
│          │                    │                    │            │
│  ┌───────┴───────┐    ┌───────┴───────┐    ┌───────┴───────┐    │
│  │               │    │               │    │               │    │
│  │  API          │    │  Notification │    │  Template     │    │
│  │  Endpoints    │    │  Processor    │    │  Renderer     │    │
│  │               │    │               │    │               │    │
│  └───────────────┘    └───────────────┘    └───────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Pipeline Details

### 1. Notification Creation

The notification pipeline begins with the Notification Worker creating notifications in the database:

```
┌──────────────────┐
│ Event Occurs     │
│ (New Content)    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Notification     │
│ Worker Process   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐    ┌──────────────────┐
│ Store in         │    │ User Preferences │
│ Database         │<───┤ Check            │
└────────┬─────────┘    └──────────────────┘
         │
         ▼
┌──────────────────┐
│ Publish to       │
│ PubSub           │
└──────────────────┘
```

### 2. Message Routing and Processing

PubSub routes messages based on notification type:

```
┌──────────────────────────────────────────────────────┐
│ PubSub Service                                       │
│                                                      │
│  ┌────────────────┐         ┌────────────────┐       │
│  │                │         │                │       │
│  │ Immediate      │         │ Daily          │       │
│  │ Notifications  │         │ Notifications  │       │
│  │                │         │                │       │
│  └────────┬───────┘         └────────┬───────┘       │
│           │                          │               │
└───────────┼──────────────────────────┼───────────────┘
            │                          │
            ▼                          ▼
┌───────────────────┐      ┌───────────────────┐
│                   │      │                   │
│ Immediate         │      │ Add to Daily      │
│ Processing        │      │ Digest Queue      │
│                   │      │                   │
└────────┬──────────┘      └────────┬──────────┘
         │                          │
         │                          │
         │                          ▼
         │               ┌───────────────────┐
         │               │                   │
         │               │ Process at        │
         │               │ Scheduled Time    │
         │               │                   │
         │               └────────┬──────────┘
         │                        │
         └────────────────────────┘
                      │
                      ▼
```

### 3. Email Delivery Process

Email composition and delivery:

```
┌──────────────────┐    ┌──────────────────┐
│ Fetch            │    │ Render Email     │
│ Notification Data│───>│ with Templates   │
└────────┬─────────┘    └────────┬─────────┘
         │                       │
         ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│ User Preference  │    │ Create Email     │
│ Check            │───>│ Content          │
└────────┬─────────┘    └────────┬─────────┘
         │                       │
         ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│ OAuth2           │    │ Send via         │
│ Authentication   │───>│ Gmail SMTP       │
└────────┬─────────┘    └────────┬─────────┘
         │                       │
         ▼                       ▼
┌──────────────────┐    ┌──────────────────┐
│ Retry Logic      │    │ Mark as Sent     │
│ (If Needed)      │───>│ in Database      │
└──────────────────┘    └──────────────────┘
```

## Service Endpoints

```
┌─────────────────────────────────────────────────────┐
│ Email Notification Service API                      │
│                                                     │
│  Health Check                                       │
│  GET /                                              │
│                                                     │
│  Service Status                                     │
│  GET /status                                        │
│                                                     │
│  Test Email                                         │
│  POST /test-email                                   │
│  {                                                  │
│    "email": "recipient@example.com",                │
│    "template": "test|immediate|daily"               │
│  }                                                  │
│                                                     │
│  Process Daily Digests                              │
│  POST /process-daily                                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Dependencies and Integration

```
┌─────────────────────────────────────────────────────┐
│ External Dependencies                               │
│                                                     │
│  ┌───────────────┐    ┌───────────────┐             │
│  │               │    │               │             │
│  │  Google Cloud │    │  PostgreSQL   │             │
│  │  PubSub       │    │  Database     │             │
│  │               │    │               │             │
│  └───────────────┘    └───────────────┘             │
│                                                     │
│  ┌───────────────┐    ┌───────────────┐             │
│  │               │    │               │             │
│  │  Secret       │    │  Gmail API    │             │
│  │  Manager      │    │  (OAuth2)     │             │
│  │               │    │               │             │
│  └───────────────┘    └───────────────┘             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

## Deployment Architecture

```
┌───────────────────────────────────────────────────────┐
│ Google Cloud Platform                                 │
│                                                       │
│  ┌─────────────────┐      ┌─────────────────┐         │
│  │                 │      │                 │         │
│  │  Cloud Run      │      │  Cloud Scheduler│         │
│  │  Service        │      │  (Daily Trigger)│         │
│  │                 │      │                 │         │
│  └────────┬────────┘      └────────┬────────┘         │
│           │                        │                  │
│           │                        │                  │
│  ┌────────┴────────┐      ┌────────┴────────┐         │
│  │                 │      │                 │         │
│  │  PubSub         │      │  Secret         │         │
│  │  Topics         │      │  Manager        │         │
│  │                 │      │                 │         │
│  └────────┬────────┘      └────────┬────────┘         │
│           │                        │                  │
│           │                        │                  │
│  ┌────────┴────────┐      ┌────────┴────────┐         │
│  │                 │      │                 │         │
│  │  Cloud SQL      │      │  Container      │         │
│  │  (PostgreSQL)   │      │  Registry       │         │
│  │                 │      │                 │         │
│  └─────────────────┘      └─────────────────┘         │
│                                                       │
└───────────────────────────────────────────────────────┘
```

## Security Flow

```
┌─────────────────┐     ┌───────────────────┐     ┌─────────────────┐
│ 1. Service      │     │ 2. Secret         │     │ 3. OAuth2       │
│    Identity     │────>│    Manager        │────>│    Flow         │
└─────────────────┘     └───────────────────┘     └─────────────────┘
                                                         │
┌─────────────────┐     ┌───────────────────┐           │
│ 5. Email        │     │ 4. Token          │           │
│    Delivery     │<────│    Acquisition    │<──────────┘
└─────────────────┘     └───────────────────┘
```

## Project Information

- **Google Cloud Project**: delta-entity-447812-p2
- **Service Name**: nifya-email-service
- **Deployed URL**: https://email-notification-415554190254.us-central1.run.app
- **Region**: us-central1