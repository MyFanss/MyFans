# Requirements Document

## Introduction

The MyFans frontend currently has inconsistent form validation across its three main form areas: the subscription plan form (`SubscriptionPlanForm`), the profile settings panel (`ProfileSettingsPanel`), and the social links form (`SocialLinksForm`). While a shared `useFormValidation` hook and `shared-validators.ts` module already exist, the profile settings panel uses its own ad-hoc `fieldErrors` state and a custom `validateProfileFields` function instead of the shared hook. Error message wording, display timing (on-blur vs. on-submit), and visual error presentation also vary between forms.

This feature unifies all form validation by ensuring every form uses the shared `useFormValidation` hook, the shared validator functions, and a consistent error display pattern — while keeping all error messages user-friendly and plain-language.

## Glossary

- **Validation_System**: The combination of `useFormValidation` hook, `shared-validators.ts`, and `profile.ts` that provides field-level validation logic.
- **Form**: Any React component that collects user input and submits it — specifically `SubscriptionPlanForm`, `ProfileSettingsPanel`, and `SocialLinksForm`.
- **Field_Error**: An inline message shown beneath a form field when its value fails validation.
- **Error_Display**: The visual presentation of a `Field_Error` (red border, error text, aria attributes).
- **Shared_Validator**: A validator function exported from `src/lib/validation/shared-validators.ts` or `src/lib/validation/profile.ts`.
- **useFormValidation**: The React hook at `src/hooks/useFormValidation.ts` that manages form state, touched tracking, and field-level validation.
- **ProfileSettingsPanel**: The settings form at `src/components/settings/profile-settings-panel.tsx`.
- **SocialLinksForm**: The social links form at `src/components/settings/social-links-form.tsx`.
- **SubscriptionPlanForm**: The plan creation form at `src/components/plan/SubscriptionPlanForm.tsx`.

## Requirements

### Requirement 1: Unified Validation Hook Usage

**User Story:** As a developer, I want all forms to use the shared `useFormValidation` hook, so that validation logic is maintained in one place and behaves consistently.

#### Acceptance Criteria

1. THE `ProfileSettingsPanel` SHALL use `useFormValidation` for all field validation instead of the ad-hoc `fieldErrors` state and `validateProfileFields` function.
2. THE `SocialLinksForm` SHALL use `useFormValidation` for all field validation (already partially done; SHALL be verified complete).
3. THE `SubscriptionPlanForm` SHALL use `useFormValidation` for all field validation (already done; SHALL be verified complete).
4. WHEN a form field is validated, THE `Validation_System` SHALL invoke only `Shared_Validator` functions — no inline validation logic SHALL be duplicated inside form components.
5. THE `Validation_System` SHALL expose a single `validateAll` function that validates every configured field and returns a boolean indicating overall form validity.

---

### Requirement 2: Consistent Error Display Behavior

**User Story:** As a user, I want form errors to appear and disappear at the same time across all forms, so that the app feels predictable and I know when I've fixed a problem.

#### Acceptance Criteria

1. WHEN a user leaves a field (blur event), THE `Form` SHALL validate that field and display a `Field_Error` if the value is invalid.
2. WHEN a user submits a form with invalid fields, THE `Form` SHALL validate all fields and display `Field_Error` messages for every invalid field before submission proceeds.
3. WHEN a user corrects a field that previously showed a `Field_Error` and then blurs or resubmits, THE `Form` SHALL clear the `Field_Error` for that field.
4. WHILE a form is submitting, THE `Form` SHALL disable the submit button to prevent duplicate submissions.
5. IF a form submission fails due to a server or network error, THEN THE `Form` SHALL display a toast notification with a user-friendly message and SHALL NOT clear field values.

---

### Requirement 3: Consistent Error Display Presentation

**User Story:** As a user, I want error messages to look the same across all forms, so that I can quickly identify and fix problems without confusion.

#### Acceptance Criteria

1. THE `Error_Display` SHALL render the `Field_Error` message as text beneath the invalid field using a consistent style (red color, small font size).
2. THE `Error_Display` SHALL apply a red border to the invalid input element when a `Field_Error` is present.
3. THE `Error_Display` SHALL include `aria-invalid="true"` on the invalid input element when a `Field_Error` is present.
4. THE `Error_Display` SHALL include an `aria-describedby` attribute on the invalid input element that references the `id` of the error message element.
5. THE `Error_Display` SHALL use `role="alert"` on the error message element so screen readers announce the error.
6. WHEN no `Field_Error` is present for a field, THE `Error_Display` SHALL remove the red border and `aria-invalid` attribute from that field's input element.

---

### Requirement 4: User-Friendly Error Messages

**User Story:** As a user, I want error messages to be written in plain language, so that I understand what went wrong and how to fix it without needing technical knowledge.

#### Acceptance Criteria

1. THE `Validation_System` SHALL produce error messages that describe the problem in plain language without technical jargon (e.g., "Name is required" not "REQUIRED_FIELD").
2. THE `Validation_System` SHALL produce error messages that are specific to the field being validated (e.g., "Username must be 3–30 characters" not "Invalid format").
3. IF a required field is empty, THEN THE `Validation_System` SHALL produce a message of the form "[Field label] is required".
4. IF a field value exceeds a maximum length, THEN THE `Validation_System` SHALL produce a message stating the maximum (e.g., "Name must be 60 characters or less").
5. IF a field value does not match an expected format, THEN THE `Validation_System` SHALL produce a message that describes the expected format (e.g., "Invalid X handle (1–15 characters)").
6. THE `Validation_System` SHALL NOT expose internal error codes (e.g., `REQUIRED_FIELD`, `FIELD_TOO_LONG`) directly to the user interface.

---

### Requirement 5: Shared Validator Coverage

**User Story:** As a developer, I want all field-level validation rules to live in the shared validator module, so that the same rules apply everywhere the same field type appears.

#### Acceptance Criteria

1. THE `shared-validators.ts` module SHALL export a validator for every field type used across `ProfileSettingsPanel`, `SocialLinksForm`, and `SubscriptionPlanForm`.
2. WHEN the same field type (e.g., avatar URL, subscription price) appears in multiple forms, THE `Validation_System` SHALL apply the same validation rule from the same `Shared_Validator` function in all forms.
3. THE `shared-validators.ts` module SHALL export validators for: `username`, `displayName`, `avatarUrl`, `bannerUrl`, `website`, `xHandle`, `instagramHandle`, `planName`, `planDescription`, `planPrice`, and `subscriptionPrice`.
4. WHERE a field is optional, THE `Shared_Validator` for that field SHALL accept an empty string as valid and only validate non-empty values.

---

### Requirement 6: Test Coverage

**User Story:** As a developer, I want automated tests for the unified validation system, so that regressions are caught before they reach users.

#### Acceptance Criteria

1. THE `useFormValidation` hook SHALL have unit tests covering: required field validation, blur-triggered validation, submit-triggered validation, and error clearing on correction.
2. THE `shared-validators.ts` module SHALL have unit tests covering: valid inputs, invalid inputs, and edge cases (empty string, boundary lengths, malformed URLs, invalid handles) for each exported validator.
3. THE `SubscriptionPlanForm` component SHALL have unit tests verifying that `Field_Error` messages appear on submit with invalid data and disappear after correction.
4. THE `SocialLinksForm` component SHALL have unit tests verifying that `Field_Error` messages appear on blur with invalid data and disappear after correction.
5. THE `ProfileSettingsPanel` component SHALL have unit tests verifying that `Field_Error` messages appear on submit with invalid data and disappear after correction.
6. FOR ALL `Shared_Validator` functions that accept a string, THE test suite SHALL verify that `validate(x)` produces the same result as `validate(validate_then_format(x))` — i.e., re-validating a value that already passed validation SHALL still pass (idempotence property).
