# 📊 REPORTS MODULE – Detailed Documentation

## Overview

The **Reports module** provides a centralized analytics and reporting system for
tracking **Users, Investors, and Customers (Companies)** across meetings,
calls, follow-ups, and engagement outcomes.

This module is **data-driven**, **date-range based**, and **status-aware**,
allowing admins and team members to understand:

- Who is engaging with whom
- How often interactions happen
- What outcomes result from those interactions

> The Reports module is **read-only** and is built entirely on top of existing
database tables. No duplicate or derived transactional data is stored.

---

## Core Objectives

- Provide actionable insights across Users, Investors, and Companies
- Enable decision-making based on real engagement data
- Allow filtering by date range, status, and interaction type
- Unify engagement tracking (meetings, calls, follow-ups, interest outcomes)

---

## Entities Covered

The Reports module supports three primary report types:

1. **User Reports**
2. **Investor Reports**
3. **Customer (Company) Reports**

Each report type supports independent filtering and aggregation logic.

---

## Global Filters (Applicable to All Reports)

### Mandatory Filters
- **From Date**
- **To Date**

All reports are generated strictly within the selected date range.

### Optional Filters
- Status  
- Interaction Type (Call, Meeting, Follow-up)
- Meeting Type (Virtual / Physical)
- User
- Investor
- Customer (Company)

> The date range filter is the primary driver of report data.

---

## 1️⃣ User Reports

### Purpose

User Reports provide insight into **individual user activity**, performance,
and engagement with investors and customers.

---

### Supported Filters
- User
- Date Range
- Interaction Type
- Status

---

### Key Metrics

| Metric | Description |
|------|-------------|
| Total Meetings | Meetings scheduled by the user |
| Meetings Completed | Meetings that already occurred |
| Meetings Pending | Future scheduled meetings |
| Total Calls | Calls made by the user |
| Follow-ups Created | Follow-ups scheduled |
| Investors Connected | Unique investors engaged |
| Companies Connected | Unique customers (companies) engaged |
| Interested Outcomes | Positive engagement results |
| Not Interested Outcomes | Negative engagement results |

---

### Relationship Insights

For a selected user, the report shows:
- Which investors the user interacted with
- Which companies the user interacted with
- Type of interaction per relationship
- Outcome of each interaction

---

### Data Sources

- `meetings.created_by`
- `followups`
- `interactions`
- `investor_lists`
- `investor_contact_status`
- `companies`

---

## 2️⃣ Investor Reports

### Purpose

Investor Reports analyze **investor engagement behavior** and their interest
levels across users and companies.

---

### Supported Filters
- Investor
- Date Range
- Status
- Meeting Type

---

### Key Metrics

| Metric | Description |
|------|-------------|
| Total Meetings | Meetings with the investor |
| Calls Done | Calls recorded |
| Follow-ups | Follow-up count |
| Users Involved | Unique users who interacted |
| Companies Engaged | Companies involved |
| Interested Companies | Companies marked as interested |
| Not Interested Companies | Companies marked as not interested |

---

### Relationship Insights

For a selected investor, the report shows:
- Which users interacted with the investor
- Which companies were involved
- Outcome per company interaction

---

### Data Sources

- `meetings.investor_id`
- `followups.investor_id`
- `interactions`
- `investor_lists`
- `investor_contact_status`
- `companies`

---

## 3️⃣ Customer (Company) Reports

### Purpose

Customer Reports track **company-level engagement** with investors and users.

---

### Supported Filters
- Customer (Company)
- Date Range
- Status
- Interaction Type

---

### Key Metrics

| Metric | Description |
|------|-------------|
| Total Meetings | Meetings related to the company |
| Investors Involved | Unique investors engaged |
| Users Involved | Unique users engaged |
| Interested Investors | Investors showing interest |
| Not Interested Investors | Investors not interested |
| Follow-ups | Follow-ups created |

---

### Relationship Insights

For a selected company, the report shows:
- Investors who interacted with the company
- Users involved in interactions
- Outcome per investor

---

### Data Sources

- `meetings.company_id`
- `followups.company_id`
- `interactions`
- `investor_lists`
- `users`

---

## Status Logic (Unified Across Reports)

The Reports module uses a **single, consistent status model**.

| Status | Logic |
|------|------|
| Meeting Scheduled | `meeting_datetime > NOW()` |
| Meeting Done | `meeting_datetime <= NOW()` |
| Interested | `interactions.outcome = 'interested'` OR `investor_lists.list_type = 'interested'` |
| Not Interested | `interactions.outcome = 'not_interested'` |
| Follow-up | `interactions.outcome = 'follow_up'` |

---

### Combined Status Scenarios

- Interested Investor & Company
- Not Interested Investor & Company
- Meeting Done → Follow-up Required
- Meeting Scheduled → Pending Outcome

---

## Backend API Design

### Endpoint

















































5️⃣ Aggregated Metrics (Backend Calculations)
✅ User Report Metrics

Calculated from meetings table:

Total meetings

Meetings done (past meetings)

Meetings scheduled (future meetings)

Unique investors connected

Unique companies connected

✅ Investor Report Metrics

Calculated from meetings + interactions:

Total meetings with investor

Unique users involved

Unique companies engaged

Interested companies count

Not interested companies count

✅ Company Report Metrics

Calculated from meetings + interactions:

Total meetings related to company

Unique investors involved

Unique users involved

Interested investors count

Not interested investors count

6️⃣ Consistent Status Logic (Backend)

Implemented via SQL conditions:

Status	Logic
Meeting Scheduled	meeting_datetime > NOW()
Meeting Done	meeting_datetime <= NOW()
Interested	interactions.outcome = 'interested'
Not Interested	interactions.outcome = 'not_interested'





🚀 Next Enhancements (Recommended)

Tell me which one you want next:

1️⃣ Status filters (Interested / Not Interested / Meeting Done)
2️⃣ Detailed table (click metric → raw meetings)
3️⃣ Charts (Recharts)
4️⃣ Export CSV / Excel
5️⃣ Entity dropdown instead of ID input

I’ll implement it cleanly step-by-step.

550e8400-e29b-41d4-a716-446655440035
eab7b9ab-8a80-4c7a-a9b9-4ed3e54da9ec

abhit userid 41b649b2-f4c5-4581-8818-b976694ea8ef

fintech eab7b9ab-8a80-4c7a-a9b9-4ed3e54da9ec