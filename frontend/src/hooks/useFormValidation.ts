'use client';

import { useState, useCallback, useMemo, type ChangeEvent, type FormEvent } from 'react';
import {
  type ErrorCode,
  type FieldError,
  createAppError,
} from '@/types/errors';

/** Validation rule for a field */
export interface ValidationRule {
  /** Check if value is valid */
  validate: (value: unknown, formData?: Record<string, unknown>) => boolean;
  /** Error code if validation fails */
  errorCode: ErrorCode;
  /** Custom error message */
  message?: string;
}

/** Field configuration */
export interface FieldConfig {
  /** Validation rules */
  rules?: ValidationRule[];
  /** Whether field is required */
  required?: boolean;
  /** Custom required message */
  requiredMessage?: string;
  /** Minimum length for strings */
  minLength?: number;
  /** Maximum length for strings */
  maxLength?: number;
  /** Pattern to match (for strings) */
  pattern?: RegExp;
  /** Custom pattern error message */
  patternMessage?: string;
  /** Custom validator function */
  customValidator?: (value: unknown, formData?: Record<string, unknown>) => string | null;
}

/** Form field configuration */
export type FormFieldsConfig<T extends Record<string, unknown>> = {
  [K in keyof T]?: FieldConfig;
};

/** Form validation result */
export interface FormValidationResult<T> {
  /** Form values */
  values: T;
  /** Field errors */
  errors: Record<keyof T, FieldError | null>;
  /** Whether form has any errors */
  hasErrors: boolean;
  /** Whether a specific field has error */
  hasFieldError: (field: keyof T) => boolean;
  /** Get error message for a field */
  getError: (field: keyof T) => string | null;
  /** Handle input change */
  handleChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  /** Handle field blur (triggers validation) */
  handleBlur: (field: keyof T) => void;
  /** Validate a single field */
  validateField: (field: keyof T, value?: unknown) => boolean;
  /** Validate all fields */
  validateAll: () => boolean;
  /** Set field value manually */
  setFieldValue: (field: keyof T, value: unknown) => void;
  /** Set field error manually */
  setFieldError: (field: keyof T, error: FieldError | null) => void;
  /** Clear all errors */
  clearErrors: () => void;
  /** Reset form to initial values */
  reset: () => void;
  /** Handle form submit */
  handleSubmit: (onSubmit: (values: T) => void | Promise<void>) => (e: FormEvent) => Promise<void>;
  /** Touched fields */
  touched: Set<keyof T>;
  /** Whether form is dirty (has changes) */
  isDirty: boolean;
  /** Whether form is submitting */
  isSubmitting: boolean;
}

/**
 * useFormValidation - Hook for form validation
 *
 * @example
 * ```tsx
 * const form = useFormValidation({
 *   initialValues: { email: '', password: '' },
 *   fields: {
 *     email: {
 *       required: true,
 *       pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
 *       patternMessage: 'Please enter a valid email',
 *     },
 *     password: {
 *       required: true,
 *       minLength: 8,
 *     },
 *   },
 * });
 *
 * <form onSubmit={form.handleSubmit(async (values) => {
 *   await submitForm(values);
 * })}>
 *   <input name="email" onChange={form.handleChange} onBlur={() => form.handleBlur('email')} />
 *   {form.getError('email') && <span>{form.getError('email')}</span>}
 * </form>
 * ```
 */
export function useFormValidation<T extends Record<string, unknown>>(options: {
  /** Initial form values */
  initialValues: T;
  /** Field configurations */
  fields?: FormFieldsConfig<T>;
  /** Validate on blur */
  validateOnBlur?: boolean;
  /** Validate on change */
  validateOnChange?: boolean;
  /** Custom form validator */
  customValidator?: (values: T) => Record<keyof T, FieldError | null> | null;
}): FormValidationResult<T> {
  const {
    initialValues,
    fields = {},
    validateOnBlur = true,
    validateOnChange = false,
    customValidator,
  } = options;

  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Record<keyof T, FieldError | null>>(
    () => createEmptyErrors(initialValues)
  );
  const [touched, setTouched] = useState<Set<keyof T>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if form is dirty
  const isDirty = useMemo(() => {
    return Object.keys(initialValues).some((key) => {
      const k = key as keyof T;
      return values[k] !== initialValues[k];
    });
  }, [values, initialValues]);

  // Create empty errors object
  function createEmptyErrors(obj: T): Record<keyof T, FieldError | null> {
    const result = {} as Record<keyof T, FieldError | null>;
    for (const key in obj) {
      result[key] = null;
    }
    return result;
  }

  // Validate a single field
  const validateField = useCallback(
    (field: keyof T, value?: unknown): boolean => {
      const fieldValue = value !== undefined ? value : values[field];
      const config = fields[field] as FieldConfig | undefined;

      if (!config) return true;

      let error: FieldError | null = null;

      // Required check
      if (config.required) {
        if (
          fieldValue === undefined ||
          fieldValue === null ||
          fieldValue === '' ||
          (Array.isArray(fieldValue) && fieldValue.length === 0)
        ) {
          error = {
            field: String(field),
            message: config.requiredMessage ?? 'This field is required',
            code: 'REQUIRED_FIELD',
          };
          setErrors((prev) => ({ ...prev, [field]: error }));
          return false;
        }
      }

      // Skip further validation if field is empty and not required
      if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
        setErrors((prev) => ({ ...prev, [field]: null }));
        return true;
      }

      // Min length
      if (config.minLength !== undefined && typeof fieldValue === 'string') {
        if (fieldValue.length < config.minLength) {
          error = {
            field: String(field),
            message: `Must be at least ${config.minLength} characters`,
            code: 'FIELD_TOO_SHORT',
          };
          setErrors((prev) => ({ ...prev, [field]: error }));
          return false;
        }
      }

      // Max length
      if (config.maxLength !== undefined && typeof fieldValue === 'string') {
        if (fieldValue.length > config.maxLength) {
          error = {
            field: String(field),
            message: `Must be at most ${config.maxLength} characters`,
            code: 'FIELD_TOO_LONG',
          };
          setErrors((prev) => ({ ...prev, [field]: error }));
          return false;
        }
      }

      // Pattern
      if (config.pattern && typeof fieldValue === 'string') {
        if (!config.pattern.test(fieldValue)) {
          error = {
            field: String(field),
            message: config.patternMessage ?? 'Invalid format',
            code: 'INVALID_FORMAT',
          };
          setErrors((prev) => ({ ...prev, [field]: error }));
          return false;
        }
      }

      // Custom rules
      if (config.rules) {
        for (const rule of config.rules) {
          if (!rule.validate(fieldValue, values)) {
            error = {
              field: String(field),
              message: rule.message ?? createAppError(rule.errorCode).message,
              code: rule.errorCode,
            };
            setErrors((prev) => ({ ...prev, [field]: error }));
            return false;
          }
        }
      }

      // Custom validator
      if (config.customValidator) {
        const customError = config.customValidator(fieldValue, values);
        if (customError) {
          error = {
            field: String(field),
            message: customError,
            code: 'VALIDATION_ERROR',
          };
          setErrors((prev) => ({ ...prev, [field]: error }));
          return false;
        }
      }

      setErrors((prev) => ({ ...prev, [field]: null }));
      return true;
    },
    [values, fields]
  );

  // Validate all fields
  const validateAll = useCallback((): boolean => {
    let isValid = true;
    const newErrors = { ...errors };

    // Validate each field
    for (const field in fields) {
      const f = field as keyof T;
      if (!validateField(f)) {
        isValid = false;
        newErrors[f] = errors[f];
      }
    }

    // Run custom form validator
    if (customValidator) {
      const customErrors = customValidator(values);
      if (customErrors) {
        for (const field in customErrors) {
          const f = field as keyof T;
          if (customErrors[f]) {
            newErrors[f] = customErrors[f];
            isValid = false;
          }
        }
      }
    }

    setErrors(newErrors);
    return isValid;
  }, [errors, fields, validateField, customValidator, values]);

  // Handle input change
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value, type } = e.target;
      const field = name as keyof T;

      let newValue: unknown = value;
      if (type === 'checkbox') {
        newValue = (e.target as HTMLInputElement).checked;
      } else if (type === 'number') {
        newValue = value === '' ? '' : Number(value);
      }

      setValues((prev) => ({ ...prev, [field]: newValue }));

      if (validateOnChange) {
        validateField(field, newValue);
      }
    },
    [validateOnChange, validateField]
  );

  // Handle field blur
  const handleBlur = useCallback(
    (field: keyof T) => {
      setTouched((prev) => new Set(prev).add(field));
      if (validateOnBlur) {
        validateField(field);
      }
    },
    [validateOnBlur, validateField]
  );

  // Set field value manually
  const setFieldValue = useCallback(
    (field: keyof T, value: unknown) => {
      setValues((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // Set field error manually
  const setFieldError = useCallback(
    (field: keyof T, error: FieldError | null) => {
      setErrors((prev) => ({ ...prev, [field]: error }));
    },
    []
  );

  // Clear all errors
  const clearErrors = useCallback(() => {
    setErrors(createEmptyErrors(initialValues));
  }, [initialValues]);

  // Reset form
  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors(createEmptyErrors(initialValues));
    setTouched(new Set());
  }, [initialValues]);

  // Handle form submit
  const handleSubmit = useCallback(
    (onSubmit: (values: T) => void | Promise<void>) => async (e: FormEvent) => {
      e.preventDefault();

      // Mark all fields as touched
      const allFields = new Set(Object.keys(values) as (keyof T)[]);
      setTouched(allFields);

      // Validate all fields
      if (!validateAll()) {
        return;
      }

      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, validateAll]
  );

  // Check if form has errors
  const hasErrors = useMemo(() => {
    return Object.values(errors).some((error) => error !== null);
  }, [errors]);

  // Check if specific field has error
  const hasFieldError = useCallback(
    (field: keyof T): boolean => {
      return errors[field] !== null;
    },
    [errors]
  );

  // Get error message for field
  const getError = useCallback(
    (field: keyof T): string | null => {
      return errors[field]?.message ?? null;
    },
    [errors]
  );

  return {
    values,
    errors,
    hasErrors,
    hasFieldError,
    getError,
    handleChange,
    handleBlur,
    validateField,
    validateAll,
    setFieldValue,
    setFieldError,
    clearErrors,
    reset,
    handleSubmit,
    touched,
    isDirty,
    isSubmitting,
  };
}

/**
 * Common validation patterns
 */
export const validationPatterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  stellarAddress: /^G[A-Z2-7]{55}$/,
  url: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/,
  phone: /^\+?[\d\s-]{10,}$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  username: /^[a-zA-Z0-9_]{3,20}$/,
};

/**
 * Create a validation rule for matching another field
 */
export function createMatchRule<T extends Record<string, unknown>>(
  otherField: keyof T,
  message = 'Fields do not match'
): ValidationRule {
  return {
    validate: (value, formData) => {
      if (!formData) return true;
      return value === (formData as T)[otherField];
    },
    errorCode: 'PASSWORD_MISMATCH',
    message,
  };
}

/**
 * Create a validation rule for minimum value
 */
export function createMinRule(min: number, message?: string): ValidationRule {
  return {
    validate: (value) => {
      if (typeof value === 'number') {
        return value >= min;
      }
      if (typeof value === 'string' && value !== '') {
        return Number(value) >= min;
      }
      return true;
    },
    errorCode: 'INVALID_AMOUNT',
    message: message ?? `Must be at least ${min}`,
  };
}

/**
 * Create a validation rule for maximum value
 */
export function createMaxRule(max: number, message?: string): ValidationRule {
  return {
    validate: (value) => {
      if (typeof value === 'number') {
        return value <= max;
      }
      if (typeof value === 'string' && value !== '') {
        return Number(value) <= max;
      }
      return true;
    },
    errorCode: 'INVALID_AMOUNT',
    message: message ?? `Must be at most ${max}`,
  };
}
