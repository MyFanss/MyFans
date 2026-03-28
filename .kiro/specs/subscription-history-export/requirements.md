# Requirements Document

## Introduction

This feature allows fans on the MyFans platform to export their subscription history as a CSV file. Fans can trigger an export from their dashboard, optionally applying the same status and date filters available in the subscription list view. The export includes subscription status, dates, creator info, plan details, and pricing. A CSV generation utility in the NestJS backend handles the serialization, and the feature is covered by unit and integration tests.

## Glossary

- **Fan**: A registered user who subscribes to creator content on the MyFans platform.
- **Creator**: A registered user who publishes content and offers subscription plans.
- **Subscription**: A record linking a Fan to a Creator plan, with a status, start date, and expiry date.
- **Export**: A downloadable CSV file containing a Fan's subscription history records.
- **CSV_Generator**: The backend utility responsible for serializing subscription records into CSV format.
- **Export_Controller**: The NestJS controller endpoint that handles export HTTP requests.
- **Export_Service**: The NestJS service that queries subscription data and delegates to the CSV_Generator.
- **Fan_Dashboard**: The frontend UI page where a Fan manages and views their subscriptions.
- **Export_Filter**: A set of optional query parameters (status, dateFrom, dateTo) that narrow the records included in an export.
- **SubscriptionRecord**: A single row in the exported CSV, representing one subscription entry.

---

## Requirements

### Requirement 1: Export Subscription History as CSV

**User Story:** As a fan, I want to export my subscription history as a CSV file, so that I can keep a personal record of my subscriptions and payments outside the platform.

#### Acceptance Criteria

1. WHEN a Fan sends a valid export request, THE Export_Controller SHALL return a CSV file as a downloadable HTTP response with `Content-Type: text/csv` and a `Content-Disposition: attachment` header.
2. THE Export_Service SHALL include all of the Fan's subscription records in the export when no Export_Filter is applied.
3. THE CSV_Generator SHALL produce a CSV file where the first row is a header row containing the column names: `id`, `creatorId`, `creatorName`, `planName`, `price`, `currency`, `interval`, `status`, `startDate`, `currentPeriodEnd`.
4. THE CSV_Generator SHALL serialize each SubscriptionRecord as exactly one data row following the header row.
5. WHEN the Fan has no subscription records matching the request, THE Export_Service SHALL return an empty CSV containing only the header row.

---

### Requirement 2: Include Subscription Status and Dates in Export

**User Story:** As a fan, I want each exported row to include the subscription status and relevant dates, so that I can understand the full lifecycle of each subscription.

#### Acceptance Criteria

1. THE CSV_Generator SHALL include the `status` field for each SubscriptionRecord, with one of the values: `active`, `expired`, or `cancelled`.
2. THE CSV_Generator SHALL include the `startDate` field for each SubscriptionRecord, formatted as an ISO 8601 date-time string.
3. THE CSV_Generator SHALL include the `currentPeriodEnd` field for each SubscriptionRecord, formatted as an ISO 8601 date-time string.
4. WHEN a SubscriptionRecord field value contains a comma or double-quote character, THE CSV_Generator SHALL enclose that field value in double quotes and escape any internal double-quote characters by doubling them, per RFC 4180.

---

### Requirement 3: Export Works with Filtered Views

**User Story:** As a fan, I want to export only the subscriptions matching my current filter (status, date range), so that the exported data reflects exactly what I see in the dashboard.

#### Acceptance Criteria

1. WHEN an Export_Filter with a `status` value is provided, THE Export_Service SHALL include only SubscriptionRecords whose `status` matches the provided value.
2. WHEN an Export_Filter with a `dateFrom` value is provided, THE Export_Service SHALL include only SubscriptionRecords whose `startDate` is on or after `dateFrom`.
3. WHEN an Export_Filter with a `dateTo` value is provided, THE Export_Service SHALL include only SubscriptionRecords whose `startDate` is on or before `dateTo`.
4. WHEN an Export_Filter combines `status`, `dateFrom`, and `dateTo`, THE Export_Service SHALL apply all filter conditions together (logical AND).
5. IF an Export_Filter contains an unrecognized `status` value, THEN THE Export_Controller SHALL return an HTTP 400 response with a descriptive error message.
6. IF an Export_Filter contains a `dateFrom` value that is after `dateTo`, THEN THE Export_Controller SHALL return an HTTP 400 response with a descriptive error message.

---

### Requirement 4: Fan Dashboard Export Control

**User Story:** As a fan, I want an export button on my subscription dashboard, so that I can trigger a CSV download without leaving the page.

#### Acceptance Criteria

1. THE Fan_Dashboard SHALL display an export button on the subscription history view.
2. WHEN the Fan clicks the export button, THE Fan_Dashboard SHALL send an export request to the Export_Controller using the currently active filter state (status, dateFrom, dateTo).
3. WHEN the Export_Controller returns a successful CSV response, THE Fan_Dashboard SHALL trigger a file download in the browser with a filename in the format `subscriptions-{YYYY-MM-DD}.csv`.
4. WHILE an export request is in progress, THE Fan_Dashboard SHALL display a loading indicator on the export button and disable further export clicks.
5. IF the export request fails, THEN THE Fan_Dashboard SHALL display an error message to the Fan without navigating away from the dashboard.

---

### Requirement 5: CSV Generation Utility

**User Story:** As a developer, I want a reusable CSV generation utility in the backend, so that other features can produce CSV exports consistently without duplicating serialization logic.

#### Acceptance Criteria

1. THE CSV_Generator SHALL expose a function that accepts an array of SubscriptionRecords and returns a UTF-8 encoded string in valid CSV format.
2. THE CSV_Generator SHALL produce output that, when parsed back into records, yields objects with field values equal to the original input values (round-trip property).
3. WHEN the input array is empty, THE CSV_Generator SHALL return a string containing only the header row followed by a newline.
4. THE CSV_Generator SHALL handle field values of type string, number, and Date without throwing an error.
5. WHERE the platform adds new exportable record types in the future, THE CSV_Generator SHALL accept a configurable list of column definitions so that column names and field mappings can be specified per export type.
