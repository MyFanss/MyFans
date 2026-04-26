import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useOnboarding,
  isFlowFinished,
  STEP_ORDER,
  ONBOARDING_STORAGE_KEY,
  STALE_THRESHOLD_MS,
} from "./useOnboarding";

describe("isFlowFinished", () => {
  it("is false when no steps done", () => {
    expect(isFlowFinished([], [])).toBe(false);
  });

  it("is true when all steps completed", () => {
    expect(isFlowFinished([...STEP_ORDER], [])).toBe(true);
  });

  it("is true when all steps skipped", () => {
    expect(isFlowFinished([], [...STEP_ORDER])).toBe(true);
  });

  it("is true with mixed complete and skip", () => {
    expect(
      isFlowFinished(["account-type", "profile"], ["social-links", "verification"]),
    ).toBe(true);
  });
});

describe("useOnboarding", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts at account-type with empty progress", () => {
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.currentStep).toBe("account-type");
    expect(result.current.completedSteps).toEqual([]);
    expect(result.current.skippedSteps).toEqual([]);
    expect(result.current.isComplete).toBe(false);
  });

  it("skipCurrentStep advances and marks skipped", () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => {
      result.current.skipCurrentStep();
    });
    expect(result.current.skippedSteps).toContain("account-type");
    expect(result.current.currentStep).toBe("profile");
    expect(result.current.isComplete).toBe(false);
  });

  it("completing all steps via skip sets isComplete", () => {
    const { result } = renderHook(() => useOnboarding());
    for (let i = 0; i < STEP_ORDER.length; i++) {
      act(() => {
        result.current.skipCurrentStep();
      });
    }
    expect(result.current.skippedSteps.length).toBe(STEP_ORDER.length);
    expect(result.current.isComplete).toBe(true);
  });

  it("persists to localStorage", () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => {
      result.current.completeStep("account-type");
    });
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.completedSteps).toContain("account-type");
  });

  it("setOnboardingIntent stores creator intent", () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => {
      result.current.setOnboardingIntent("creator");
    });
    expect(result.current.onboardingIntent).toBe("creator");
  });

  it("resetOnboarding clears progress in state and storage", () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => {
      result.current.completeStep("account-type");
    });
    expect(result.current.completedSteps.length).toBeGreaterThan(0);
    act(() => {
      result.current.resetOnboarding();
    });
    expect(result.current.completedSteps).toEqual([]);
    expect(result.current.isComplete).toBe(false);
    const raw = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.completedSteps).toEqual([]);
  });
});

describe("stale / invalid state handling", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("resets to fresh state when savedAt is older than STALE_THRESHOLD_MS", () => {
    const staleDate = new Date(Date.now() - STALE_THRESHOLD_MS - 1000).toISOString();
    localStorage.setItem(
      ONBOARDING_STORAGE_KEY,
      JSON.stringify({
        currentStep: "profile",
        completedSteps: ["account-type"],
        skippedSteps: [],
        isComplete: false,
        onboardingIntent: "creator",
        savedAt: staleDate,
      }),
    );
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.currentStep).toBe("account-type");
    expect(result.current.completedSteps).toEqual([]);
    expect(result.current.onboardingIntent).toBeNull();
  });

  it("preserves state when savedAt is within threshold", () => {
    const recentDate = new Date(Date.now() - 1000).toISOString();
    localStorage.setItem(
      ONBOARDING_STORAGE_KEY,
      JSON.stringify({
        currentStep: "profile",
        completedSteps: ["account-type"],
        skippedSteps: [],
        isComplete: false,
        onboardingIntent: "creator",
        savedAt: recentDate,
      }),
    );
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.currentStep).toBe("profile");
    expect(result.current.completedSteps).toContain("account-type");
    expect(result.current.onboardingIntent).toBe("creator");
  });

  it("resets to fresh state when stored JSON is corrupted", () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "not-valid-json{{{");
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.currentStep).toBe("account-type");
    expect(result.current.completedSteps).toEqual([]);
  });

  it("filters out unrecognised step values from completedSteps", () => {
    const recentDate = new Date(Date.now() - 1000).toISOString();
    localStorage.setItem(
      ONBOARDING_STORAGE_KEY,
      JSON.stringify({
        currentStep: "profile",
        completedSteps: ["account-type", "unknown-step-xyz"],
        skippedSteps: [],
        isComplete: false,
        onboardingIntent: null,
        savedAt: recentDate,
      }),
    );
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.completedSteps).toContain("account-type");
    expect(result.current.completedSteps).not.toContain("unknown-step-xyz");
  });

  it("falls back to account-type when currentStep is invalid", () => {
    const recentDate = new Date(Date.now() - 1000).toISOString();
    localStorage.setItem(
      ONBOARDING_STORAGE_KEY,
      JSON.stringify({
        currentStep: "totally-invalid",
        completedSteps: [],
        skippedSteps: [],
        isComplete: false,
        onboardingIntent: null,
        savedAt: recentDate,
      }),
    );
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.currentStep).toBe("account-type");
  });

  it("resets to fresh state when savedAt is an invalid date string", () => {
    localStorage.setItem(
      ONBOARDING_STORAGE_KEY,
      JSON.stringify({
        currentStep: "profile",
        completedSteps: ["account-type"],
        skippedSteps: [],
        isComplete: false,
        onboardingIntent: "creator",
        savedAt: "not-a-date",
      }),
    );
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.currentStep).toBe("account-type");
    expect(result.current.completedSteps).toEqual([]);
  });

  it("ignores invalid onboardingIntent and defaults to null", () => {
    const recentDate = new Date(Date.now() - 1000).toISOString();
    localStorage.setItem(
      ONBOARDING_STORAGE_KEY,
      JSON.stringify({
        currentStep: "account-type",
        completedSteps: [],
        skippedSteps: [],
        isComplete: false,
        onboardingIntent: "hacker",
        savedAt: recentDate,
      }),
    );
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.onboardingIntent).toBeNull();
  });
});
