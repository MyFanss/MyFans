"use client";

import { useState, useCallback } from "react";
import { AvatarUpload } from "@/components/ui/AvatarUpload";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { useToast } from "@/components/ErrorToast";

// Mock data types
interface SocialLinks {
  website: string;
  twitter: string;
  instagram: string;
  other: string;
}

interface ProfileData {
  displayName: string;
  username: string;
  bio: string;
  avatar: string | null;
  socialLinks: SocialLinks;
}

interface WalletData {
  address: string | null;
  network: "mainnet" | "testnet";
  isConnected: boolean;
}

interface AccountStatus {
  creator: "active" | "pending" | "inactive";
  fan: "active" | "pending" | "inactive";
}

// Mock initial data
const initialProfile: ProfileData = {
  displayName: "Star Creator",
  username: "star.creator",
  bio: "Digital content creator | Sharing exclusive content for my fans",
  avatar: null,
  socialLinks: {
    website: "https://starcreator.com",
    twitter: "@starcreator",
    instagram: "@starcreator",
    other: "",
  },
};

const mockWallet: WalletData = {
  address: "GAC47WQS3V5GZT3QRWP5QJ5Q5K7X6ZJ6K2P2X5HNR5ZJT5KZJT5K7X6Z",
  network: "testnet",
  isConnected: true,
};

const mockAccountStatus: AccountStatus = {
  creator: "active",
  fan: "inactive",
};

// Validation functions
const validateUsername = (value: string): string | null => {
  if (!value) return "Username is required";
  if (!/^[a-zA-Z0-9._]+$/.test(value))
    return "Username can only contain letters, numbers, dots, and underscores";
  if (value.length < 3) return "Username must be at least 3 characters";
  if (value.length > 30) return "Username must be less than 30 characters";
  return null;
};

const validateBio = (value: string): string | null => {
  if (value.length > 500) return "Bio must be less than 500 characters";
  return null;
};

const validateUrl = (value: string, fieldName: string): string | null => {
  if (!value) return null; // Optional field
  try {
    new URL(value);
    return null;
  } catch {
    return `Invalid ${fieldName} URL`;
  }
};

const validateTwitter = (value: string): string | null => {
  if (!value) return null; // Optional field
  if (!/^@?[a-zA-Z0-9_]+$/.test(value))
    return "Invalid Twitter handle format";
  return null;
};

const validateInstagram = (value: string): string | null => {
  if (!value) return null; // Optional field
  if (!/^@?[a-zA-Z0-9_.]+$/.test(value))
    return "Invalid Instagram handle format";
  return null;
};

export default function ProfilePage() {
  // State for profile data
  const [profile, setProfile] = useState<ProfileData>(initialProfile);
  const [wallet, setWallet] = useState<WalletData>(mockWallet);
  const [accountStatus] = useState<AccountStatus>(mockAccountStatus);
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Toast notifications
  const { showSuccess, showError } = useToast();

  // Handle input changes
  const handleInputChange = useCallback(
    (field: keyof ProfileData | keyof SocialLinks, value: string) => {
      if (field in profile.socialLinks) {
        setProfile((prev) => ({
          ...prev,
          socialLinks: { ...prev.socialLinks, [field]: value },
        }));
      } else {
        setProfile((prev) => ({ ...prev, [field]: value }));
      }
      // Clear error when user types
      if (errors[field]) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    },
    [errors]
  );

  // Validate all fields
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    const usernameError = validateUsername(profile.username);
    if (usernameError) newErrors.username = usernameError;

    const bioError = validateBio(profile.bio);
    if (bioError) newErrors.bio = bioError;

    const websiteError = validateUrl(profile.socialLinks.website, "website");
    if (websiteError) newErrors.website = websiteError;

    const twitterError = validateTwitter(profile.socialLinks.twitter);
    if (twitterError) newErrors.twitter = twitterError;

    const instagramError = validateInstagram(profile.socialLinks.instagram);
    if (instagramError) newErrors.instagram = instagramError;

    const otherError = validateUrl(profile.socialLinks.other, "other");
    if (otherError) newErrors.other = otherError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = useCallback(async () => {
    if (!validateForm()) {
      showError("VALIDATION_ERROR", {
        message: "Please fix the errors before saving",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Mock API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      showSuccess("Profile saved successfully!");
    } catch {
      showError("UNKNOWN_ERROR", {
        message: "Failed to save profile",
      });
    } finally {
      setIsSaving(false);
    }
  }, [profile, showSuccess, showError]);

  // Handle avatar upload
  const handleAvatarUpload = useCallback((file: File) => {
    // In real app, this would upload to server
    console.log("Avatar file selected:", file.name);
  }, []);

  // Handle disconnect wallet
  const handleDisconnect = useCallback(() => {
    setWallet({ address: null, network: "testnet", isConnected: false });
  }, []);

  // Handle connect wallet (mock)
  const handleConnectWallet = useCallback(() => {
    setWallet(mockWallet);
  }, []);

  // Copy address to clipboard
  const copyAddress = useCallback(async () => {
    if (!wallet.address) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
      showSuccess("Address copied to clipboard!");
    } catch {
      showError("UNKNOWN_ERROR", { message: "Failed to copy address" });
    }
  }, [wallet.address, showSuccess, showError]);

  // Truncate address for display
  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}…${addr.slice(-6)}`;
  };

  // Status badge variant
  const getStatusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "success";
      case "pending":
        return "warning";
      case "inactive":
        return "default";
      default:
        return "default";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Profile
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage your personal information and account settings
          </p>
        </div>

        {/* Two Column Layout */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left Column - Personal Information & Social Links */}
          <div className="space-y-6">
            {/* Personal Information Card */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Personal Information
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                This information is visible to other users
              </p>

              <div className="mt-6 space-y-6">
                {/* Avatar */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Avatar
                  </label>
                  <div className="mt-2">
                    <AvatarUpload
                      currentAvatar={profile.avatar}
                      userName={profile.displayName}
                      onFileSelect={handleAvatarUpload}
                      maxSize={1024 * 1024} // 1MB
                      acceptedTypes={["image/jpeg", "image/png"]}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    JPG or PNG only. Max 1MB.
                  </p>
                </div>

                {/* Display Name */}
                <Input
                  label="Display Name"
                  value={profile.displayName}
                  onChange={(e) => handleInputChange("displayName", e.target.value)}
                  placeholder="Your display name"
                  error={errors.displayName}
                />

                {/* Username */}
                <Input
                  label="Username"
                  value={profile.username}
                  onChange={(e) => handleInputChange("username", e.target.value)}
                  placeholder="@username"
                  error={errors.username}
                  hint="This is how other users will mention you"
                />

                {/* Bio */}
                <Textarea
                  label="Bio"
                  value={profile.bio}
                  onChange={(e) => handleInputChange("bio", e.target.value)}
                  placeholder="Tell us about yourself..."
                  error={errors.bio}
                  hint={`${profile.bio.length}/500 characters`}
                  rows={4}
                />
              </div>
            </div>

            {/* Social Links Card */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Social Links
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Add your social media profiles
              </p>

              <div className="mt-6 space-y-4">
                {/* Website */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                      />
                    </svg>
                    Website
                  </label>
                  <Input
                    label="Website"
                    value={profile.socialLinks.website}
                    onChange={(e) =>
                      handleInputChange("website", e.target.value)
                    }
                    placeholder="https://yourwebsite.com"
                    error={errors.website}
                    className="mt-1"
                  />
                </div>

                {/* X/Twitter */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    X / Twitter
                  </label>
                  <Input
                    label="X / Twitter"
                    value={profile.socialLinks.twitter}
                    onChange={(e) =>
                      handleInputChange("twitter", e.target.value)
                    }
                    placeholder="@username"
                    error={errors.twitter}
                    className="mt-1"
                  />
                </div>

                {/* Instagram */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                    </svg>
                    Instagram
                  </label>
                  <Input
                    label="Instagram"
                    value={profile.socialLinks.instagram}
                    onChange={(e) =>
                      handleInputChange("instagram", e.target.value)
                    }
                    placeholder="@username"
                    error={errors.instagram}
                    className="mt-1"
                  />
                </div>

                {/* Other */}
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                      />
                    </svg>
                    Other
                  </label>
                  <Input
                    label="Other"
                    value={profile.socialLinks.other}
                    onChange={(e) =>
                      handleInputChange("other", e.target.value)
                    }
                    placeholder="https://..."
                    error={errors.other}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Wallet & Account Type */}
          <div className="space-y-6">
            {/* Wallet Card */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Wallet
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Manage your connected wallet
              </p>

              <div className="mt-6">
                {wallet.isConnected ? (
                  <div className="space-y-4">
                    {/* Connected Address */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Connected Address
                      </label>
                      <div className="mt-1 flex items-center gap-2">
                        <code className="flex-1 break-all rounded-lg bg-gray-100 px-3 py-2 text-sm font-mono text-gray-900 dark:bg-gray-700 dark:text-gray-100">
                          {truncateAddress(wallet.address!)}
                        </code>
                        <button
                          onClick={copyAddress}
                          className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
                          title="Copy address"
                        >
                          <svg
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Network */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Network
                      </label>
                      <div className="mt-1">
                        <Badge variant={wallet.network === "mainnet" ? "success" : "warning"}>
                          {wallet.network === "mainnet"
                            ? "Stellar Mainnet"
                            : "Stellar Testnet"}
                        </Badge>
                      </div>
                    </div>

                    {/* Disconnect Button */}
                    <button
                      onClick={handleDisconnect}
                      className="mt-4 w-full rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                    >
                      Disconnect Wallet
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="mb-4 text-gray-600 dark:text-gray-400">
                      No wallet connected
                    </p>
                    <button
                      onClick={handleConnectWallet}
                      className="rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 dark:bg-primary-600 dark:hover:bg-primary-700"
                    >
                      Connect Wallet
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Account Type Card */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Account Type
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Your account status on the platform
              </p>

              <div className="mt-6 space-y-4">
                {/* Creator Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Creator Status
                  </label>
                  <div className="mt-2">
                    <Badge variant={getStatusVariant(accountStatus.creator)}>
                      {accountStatus.creator.charAt(0).toUpperCase() +
                        accountStatus.creator.slice(1)}
                    </Badge>
                  </div>
                </div>

                {/* Fan Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Fan Status
                  </label>
                  <div className="mt-2">
                    <Badge variant={getStatusVariant(accountStatus.fan)}>
                      {accountStatus.fan.charAt(0).toUpperCase() +
                        accountStatus.fan.slice(1)}
                    </Badge>
                  </div>
                </div>

                {/* Instructional Text */}
                <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                  You can switch between creator and fan modes using the toggle in
                  the sidebar.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex justify-end gap-4">
          {isAuthenticated ? (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-lg bg-primary-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary-600 dark:hover:bg-primary-700"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          ) : (
            <button className="rounded-lg bg-primary-500 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-600 dark:bg-primary-600 dark:hover:bg-primary-700">
              Login
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
