"use client";

import { useState, useEffect, useCallback } from "react";
import {
  createCheckout,
  getFullCheckoutData,
  validateBalance as apiValidateBalance,
  confirmSubscription as apiConfirmSubscription,
  CheckoutResponse,
  PlanSummary,
  PriceBreakdown,
  WalletStatus,
  TransactionPreview,
  AssetBalance,
  CheckoutResult,
} from "@/lib/checkout";
import { useTransaction } from "@/hooks/useTransaction";
import { useToast } from "@/components/ErrorToast";
import { createTrackedTransaction, getExplorerUrl } from "@/lib/transaction-history";

import PlanSummaryComponent from "./PlanSummary";
import PriceBreakdownComponent from "./PriceBreakdown";
import AssetSelectorComponent from "./AssetSelector";
import WalletBalanceComponent from "./WalletBalance";
import TransactionPreviewComponent from "./TransactionPreview";
import CheckoutResultDisplay from "./CheckoutResult";
import TxFailureRecovery from "./TxFailureRecovery";
import TransactionProgress from "./TransactionProgress"; // ✅ new import

export type CheckoutStep = "select" | "preview" | "confirm" | "result";

interface CheckoutFlowProps {
  fanAddress: string;
  creatorAddress: string;
  planId: number;
  onComplete?: (result: CheckoutResult) => void;
  onCancel?: () => void;
}

export default function CheckoutFlow({
  fanAddress,
  creatorAddress,
  planId,
  onComplete,
  onCancel,
}: CheckoutFlowProps) {
  const { showError, showSuccess } = useToast();

  // Checkout state
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<CheckoutStep>("select");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [checkout, setCheckout] = useState<CheckoutResponse | null>(null);
  const [planSummary, setPlanSummary] = useState<PlanSummary | null>(null);
  const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdown | null>(
    null
  );
  const [walletStatus, setWalletStatus] = useState<WalletStatus | null>(null);
  const [transactionPreview, setTransactionPreview] =
    useState<TransactionPreview | null>(null);

  // Selection state
  const [selectedAsset, setSelectedAsset] = useState<AssetBalance | null>(null);
  const [balanceValidation, setBalanceValidation] = useState<{
    valid: boolean;
    balance: string;
    shortfall?: string;
  } | null>(null);

  // Result state
  const [checkoutResult, setCheckoutResult] = useState<CheckoutResult | null>(
    null
  );

  // Referral code state
  const referralEnabled = useFeatureFlag(FeatureFlag.REFERRAL_CODES);
  const [appliedReferralCode, setAppliedReferralCode] = useState<string | null>(null);

  // Transaction hook
  const tx = useTransaction({
    type: "subscription",
    amount: priceBreakdown ? parseFloat(priceBreakdown.total) : undefined,
    onSuccess: () => {
      showSuccess(
        "Transaction successful!",
        "You are now subscribed to this creator."
      );
    },
    onError: (err) => {
      showError(err);
    },
  });

  // Initialize checkout
  useEffect(() => {
    const initCheckout = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Create checkout session
        const newCheckout = await createCheckout({
          fanAddress,
          creatorAddress,
          planId,
        });

        setCheckoutId(newCheckout.id);
        setCheckout(newCheckout);

        // Get full checkout data
        const data = await getFullCheckoutData(newCheckout.id);

        setPlanSummary(data.planSummary);
        setPriceBreakdown(data.priceBreakdown);
        setWalletStatus(data.walletStatus);
        setTransactionPreview(data.preview);

        // Auto-select first asset with balance
        if (data.walletStatus.balances.length > 0) {
          const assetWithBalance =
            data.walletStatus.balances.find((b) => parseFloat(b.balance) > 0) ||
            data.walletStatus.balances[0];

          setSelectedAsset(assetWithBalance);

          // Validate balance for this asset
          const validation = await apiValidateBalance(
            newCheckout.id,
            assetWithBalance.code,
            data.priceBreakdown.total
          );
          setBalanceValidation(validation);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to initialize checkout"
        );
      } finally {
        setIsLoading(false);
      }
    };

    initCheckout();
  }, [fanAddress, creatorAddress, planId]);

  // Handle asset selection
  const handleAssetSelect = useCallback(
    async (asset: AssetBalance) => {
      if (!checkoutId || !priceBreakdown) return;

      setSelectedAsset(asset);

      // Validate balance for selected asset
      try {
        const validation = await apiValidateBalance(
          checkoutId,
          asset.code,
          priceBreakdown.total
        );
        setBalanceValidation(validation);
      } catch (err) {
        console.error("Failed to validate balance:", err);
      }
    },
    [checkoutId, priceBreakdown]
  );

  // Handle continue to preview
  const handleContinueToPreview = useCallback(() => {
    if (!balanceValidation?.valid) {
      const base = createAppError("INSUFFICIENT_BALANCE");
      showError("INSUFFICIENT_BALANCE", {
        message: base.message,
        description: balanceValidation?.shortfall
          ? `${base.description} You’re short by about ${balanceValidation.shortfall} for this plan—pick another asset or add funds.`
          : base.description,
      });
      return;
    }
    setCurrentStep("preview");
  }, [balanceValidation, showError]);

  // Handle continue to confirm
  const handleContinueToConfirm = useCallback(() => {
    setCurrentStep("confirm");
  }, []);

  // Handle submit transaction
  const handleSubmit = useCallback(async () => {
    if (!checkoutId) return;

    await tx.execute(async () => {
      const txHash = `tx_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 11)}`;

      // Simulate transaction submission
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          const shouldFail = Math.random() < 0.1; // 10% chance of failure
          if (shouldFail) {
            reject(new Error("Transaction rejected by user"));
          } else {
            resolve(txHash);
          }
        }, 2000);
      });

      // Confirm with backend
      const result = await apiConfirmSubscription(checkoutId, txHash);
      const trackedTransaction = createTrackedTransaction({
        checkoutId,
        txHash,
        type: "subscription",
        description: planSummary
          ? `Subscription to ${planSummary.creatorName}${planSummary.name ? ` • ${planSummary.name}` : ""}`
          : "Subscription payment",
        amount: priceBreakdown?.total ?? checkout?.total ?? "0",
        currency: priceBreakdown?.currency ?? selectedAsset?.code ?? "XLM",
        creatorName: planSummary?.creatorName,
        planName: planSummary?.name,
      });

      const nextResult = {
        ...result,
        txHash,
        explorerUrl: result.explorerUrl || getExplorerUrl(txHash),
      };

      setCheckoutResult(nextResult);
      setCurrentStep("result");
      onComplete?.(nextResult);
      return { ...nextResult, trackedTransaction };
    });
  }, [checkoutId, tx, onComplete]);

  // Handle failure
  const handleFail = useCallback(
    async (errorMessage: string, isRejected: boolean = false) => {
      if (!checkoutId) return;

      try {
        const result = await apiFailCheckout(
          checkoutId,
          errorMessage,
          isRejected
        );
        setCheckoutResult(result);
        setCurrentStep("result");
        onComplete?.(result);
      } catch (err) {
        console.error("Failed to record failure:", err);
      }
    },
    [checkoutId, onComplete]
  );

  // Handle retry
  const handleRetry = useCallback(() => {
    setCurrentStep("select");
    setCheckoutResult(null);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading checkout...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-900/20">
        <p className="text-red-700 dark:text-red-300">{error}</p>
        {onCancel && (
          <button
            onClick={onCancel}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            Go Back
          </button>
        )}
      </div>
    );
  }

  // Result state
  if (currentStep === "result" && checkoutResult) {
    return <CheckoutResultDisplay result={checkoutResult} onClose={onCancel} />;
  }

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <div className="mb-6 flex items-center justify-center gap-2">
        {["select", "preview", "confirm"].map((step, index) => (
          <div key={step} className="flex items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full ${
                currentStep === step
                  ? "bg-primary-500 text-white"
                  : ["select", "preview", "confirm"].indexOf(currentStep) > index
                  ? "bg-green-500 text-white"
                  : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
              }`}
            >
              {["select", "preview", "confirm"].indexOf(currentStep) > index ? (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <span className="text-sm font-medium">{index + 1}</span>
              )}
            </div>
            {index < 2 && (
              <div
                className={`mx-2 h-0.5 w-8 ${
                  ["select", "preview", "confirm"].indexOf(currentStep) > index
                    ? "bg-green-500"
                    : "bg-slate-200 dark:bg-slate-700"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Asset Selection */}
      {currentStep === "select" && planSummary && priceBreakdown && walletStatus && (
        <div className="space-y-4">
          <PlanSummaryComponent plan={planSummary} />
          <AssetSelectorComponent
            walletStatus={walletStatus}
            selectedAsset={selectedAsset}
            onSelectAsset={handleAssetSelect}
          />
          {selectedAsset && (
            <WalletBalanceComponent
              walletStatus={walletStatus}
              selectedAsset={selectedAsset}
              requiredAmount={priceBreakdown.total}
              validation={balanceValidation || undefined}
            />
          )}
          {referralEnabled && (
            <ReferralCodeInput
              onValidated={(code, valid) => {
                if (valid) setAppliedReferralCode(code);
                else setAppliedReferralCode(null);
              }}
            />
          )}
          <div className="flex gap-3">
            {onCancel && (
              <button
                onClick={onCancel}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleContinueToPreview}
              disabled={!balanceValidation?.valid}
              className="flex-1 rounded-lg bg-primary-500 px-4 py-3 font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary-600 dark:hover:bg-primary-700"
            >
              Continue to Preview
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {currentStep === "preview" &&
        planSummary &&
        priceBreakdown &&
        transactionPreview &&
        walletStatus && (
          <div className="space-y-4">
            <PlanSummaryComponent plan={planSummary} />
            <PriceBreakdownComponent breakdown={priceBreakdown} />
            <TransactionPreviewComponent preview={transactionPreview} />
            {selectedAsset && (
              <WalletBalanceComponent
                walletStatus={walletStatus}
                selectedAsset={selectedAsset}
                requiredAmount={priceBreakdown.total}
                validation={balanceValidation || undefined}
              />
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setCurrentStep("select")}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Back
              </button>
              <button
                onClick={handleContinueToConfirm}
                disabled={!balanceValidation?.valid}
                className="flex-1 rounded-lg bg-primary-500 px-4 py-3 font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary-600 dark:hover:bg-primary-700"
              >
                Confirm
              </button>
            </div>
          </div>
        )}

      {/* Step 3: Confirm/Submit */}
      {currentStep === "confirm" &&
        planSummary &&
        priceBreakdown &&
        transactionPreview && (
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
              <h4 className="mb-2 font-semibold text-amber-800 dark:text-amber-200">
                Confirm Your Subscription
              </h4>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                You are about to subscribe to {planSummary.creatorName} for{" "}
                {priceBreakdown.total} {priceBreakdown.currency}. This
                transaction will be signed with your wallet.
              </p>
            </div>

            <TransactionPreviewComponent preview={transactionPreview} />

            {/* Transaction progress */}
            <TransactionProgress
              stage={
                tx.isPending
                  ? "pending"
                  : tx.isFailed
                  ? "failed"
                  : tx.isSuccess
                  ? "confirmed"
                  : "signing"
              }
              txHash={(tx.data as { txHash?: string } | null)?.txHash}
              error={tx.error?.message}
              onRetry={() => {
                tx.reset();
                setCurrentStep("preview");
              }}
            />

            <div className="flex gap-3">
              <button
                onClick={() => setCurrentStep("preview")}
                disabled={tx.isPending}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={tx.isPending || tx.isSuccess}
                className="flex-1 rounded-lg bg-primary-500 px-4 py-3 font-medium text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary-600 dark:hover:bg-primary-700"
              >
                {tx.isPending ? "Processing..." : "Sign & Subscribe"}
              </button>
            </div>
          </div>
        )}
    </div>
  );
}