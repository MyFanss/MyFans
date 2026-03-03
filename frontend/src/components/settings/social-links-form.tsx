"use client";

import { useState, useMemo } from "react";

// Social platform types
interface SocialLinks {
  website: string;
  x: string;
  instagram: string;
  other: string;
}

interface ValidationErrors {
  website?: string;
  x?: string;
  instagram?: string;
  other?: string;
}

// Icon components with dark mode support
const GlobeIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
    />
  </svg>
);

const XIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"
    />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const LinkIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"
    />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M4.5 12.75l6 6 9-13.5"
    />
  </svg>
);

const ExclamationIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
    />
  </svg>
);

// Validation functions
const validateWebsite = (value: string): string | undefined => {
  if (!value.trim()) return undefined;
  const urlPattern =
    /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;
  if (!urlPattern.test(value)) {
    return "Please enter a valid website URL";
  }
  return undefined;
};

const validateX = (value: string): string | undefined => {
  if (!value.trim()) return undefined;
  // Handle format: @username or username
  const xPattern = /^@?[\w]{1,15}$/;
  if (!xPattern.test(value.replace(/^@/, ""))) {
    return "Please enter a valid X handle";
  }
  return undefined;
};

const validateInstagram = (value: string): string | undefined => {
  if (!value.trim()) return undefined;
  // Username format: letters, numbers, underscores, periods, max 30 chars
  const instagramPattern = /^[\w.]{1,30}$/;
  if (!instagramPattern.test(value)) {
    return "Please enter a valid Instagram username";
  }
  return undefined;
};

const validateOther = (value: string): string | undefined => {
  if (!value.trim()) return undefined;
  const urlPattern =
    /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;
  if (!urlPattern.test(value)) {
    return "Please enter a valid URL";
  }
  return undefined;
};

interface SocialLinksFormProps {
  initialValues?: Partial<SocialLinks>;
  onSubmit?: (links: SocialLinks) => void;
}

export function SocialLinksForm({
  initialValues,
  onSubmit,
}: SocialLinksFormProps) {
  const [links, setLinks] = useState<SocialLinks>({
    website: initialValues?.website || "",
    x: initialValues?.x || "",
    instagram: initialValues?.instagram || "",
    other: initialValues?.other || "",
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);

  // Validate all fields
  const errors = useMemo<ValidationErrors>(
    () => ({
      website: validateWebsite(links.website),
      x: validateX(links.x),
      instagram: validateInstagram(links.instagram),
      other: validateOther(links.other),
    }),
    [links]
  );

  // Check if form is valid
  const isValid = useMemo(() => {
    return !errors.website && !errors.x && !errors.instagram && !errors.other;
  }, [errors]);

  // Handle input change
  const handleChange = (field: keyof SocialLinks, value: string) => {
    setLinks((prev) => ({ ...prev, [field]: value }));
    setSubmitted(false);
  };

  // Handle blur
  const handleBlur = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  // Handle submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ website: true, x: true, instagram: true, other: true });
    setSubmitted(true);

    if (isValid && onSubmit) {
      onSubmit(links);
    }
  };

  // Check if a field has an error
  const hasError = (field: keyof ValidationErrors): boolean => {
    return touched[field] && !!errors[field];
  };

  // Check if a field is valid (touched and no error)
  const isFieldValid = (field: keyof SocialLinks): boolean => {
    return touched[field] && !errors[field] && links[field].trim() !== "";
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Website Field */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="website"
          className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          <span className="text-slate-500 dark:text-slate-400">
            <GlobeIcon className="w-4 h-4" />
          </span>
          Website
        </label>
        <div className="relative">
          <input
            id="website"
            type="text"
            value={links.website}
            onChange={(e) => handleChange("website", e.target.value)}
            onBlur={() => handleBlur("website")}
            placeholder="https://yourwebsite.com"
            className={`w-full rounded-xl border bg-white px-3 py-2.5 pr-10 text-slate-900 outline-none placeholder:text-slate-400 transition-colors focus:ring-2 focus:ring-slate-300 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-slate-600 ${
              hasError("website")
                ? "border-red-400 focus:border-red-400"
                : isFieldValid("website")
                ? "border-emerald-400 focus:border-emerald-400"
                : "border-slate-300 dark:border-slate-600"
            }`}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isFieldValid("website") && (
              <CheckIcon className="w-5 h-5 text-emerald-500" />
            )}
            {hasError("website") && (
              <ExclamationIcon className="w-5 h-5 text-red-500" />
            )}
          </div>
        </div>
        {hasError("website") && (
          <p className="text-sm text-red-500">{errors.website}</p>
        )}
      </div>

      {/* X (Twitter) Field */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="x"
          className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          <span className="text-slate-500 dark:text-slate-400">
            <XIcon className="w-4 h-4" />
          </span>
          X (Twitter)
        </label>
        <div className="relative">
          <input
            id="x"
            type="text"
            value={links.x}
            onChange={(e) => handleChange("x", e.target.value)}
            onBlur={() => handleBlur("x")}
            placeholder="@yourhandle"
            className={`w-full rounded-xl border bg-white px-3 py-2.5 pr-10 text-slate-900 outline-none placeholder:text-slate-400 transition-colors focus:ring-2 focus:ring-slate-300 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-slate-600 ${
              hasError("x")
                ? "border-red-400 focus:border-red-400"
                : isFieldValid("x")
                ? "border-emerald-400 focus:border-emerald-400"
                : "border-slate-300 dark:border-slate-600"
            }`}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isFieldValid("x") && (
              <CheckIcon className="w-5 h-5 text-emerald-500" />
            )}
            {hasError("x") && (
              <ExclamationIcon className="w-5 h-5 text-red-500" />
            )}
          </div>
        </div>
        {hasError("x") && <p className="text-sm text-red-500">{errors.x}</p>}
      </div>

      {/* Instagram Field */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="instagram"
          className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          <span className="text-slate-500 dark:text-slate-400">
            <InstagramIcon className="w-4 h-4" />
          </span>
          Instagram
        </label>
        <div className="relative">
          <input
            id="instagram"
            type="text"
            value={links.instagram}
            onChange={(e) => handleChange("instagram", e.target.value)}
            onBlur={() => handleBlur("instagram")}
            placeholder="username"
            className={`w-full rounded-xl border bg-white px-3 py-2.5 pr-10 text-slate-900 outline-none placeholder:text-slate-400 transition-colors focus:ring-2 focus:ring-slate-300 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-slate-600 ${
              hasError("instagram")
                ? "border-red-400 focus:border-red-400"
                : isFieldValid("instagram")
                ? "border-emerald-400 focus:border-emerald-400"
                : "border-slate-300 dark:border-slate-600"
            }`}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isFieldValid("instagram") && (
              <CheckIcon className="w-5 h-5 text-emerald-500" />
            )}
            {hasError("instagram") && (
              <ExclamationIcon className="w-5 h-5 text-red-500" />
            )}
          </div>
        </div>
        {hasError("instagram") && (
          <p className="text-sm text-red-500">{errors.instagram}</p>
        )}
      </div>

      {/* Other Field */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="other"
          className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          <span className="text-slate-500 dark:text-slate-400">
            <LinkIcon className="w-4 h-4" />
          </span>
          Other
        </label>
        <div className="relative">
          <input
            id="other"
            type="text"
            value={links.other}
            onChange={(e) => handleChange("other", e.target.value)}
            onBlur={() => handleBlur("other")}
            placeholder="https://linkedin.com/in/username"
            className={`w-full rounded-xl border bg-white px-3 py-2.5 pr-10 text-slate-900 outline-none placeholder:text-slate-400 transition-colors focus:ring-2 focus:ring-slate-300 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-slate-600 ${
              hasError("other")
                ? "border-red-400 focus:border-red-400"
                : isFieldValid("other")
                ? "border-emerald-400 focus:border-emerald-400"
                : "border-slate-300 dark:border-slate-600"
            }`}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isFieldValid("other") && (
              <CheckIcon className="w-5 h-5 text-emerald-500" />
            )}
            {hasError("other") && (
              <ExclamationIcon className="w-5 h-5 text-red-500" />
            )}
          </div>
        </div>
        {hasError("other") && (
          <p className="text-sm text-red-500">{errors.other}</p>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={submitted && !isValid}
        className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 dark:disabled:bg-slate-500"
      >
        Save Social Links
      </button>
    </form>
  );
}
