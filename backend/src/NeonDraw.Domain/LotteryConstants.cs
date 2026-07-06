namespace NeonDraw.Domain;

/// <summary>
/// Core lottery rules ported from the legacy client (js/lottery.js, js/wallet.js).
/// </summary>
public static class LotteryConstants
{
    public const int NumbersPerTicket = 6;
    public const int MinNumber = 1;
    public const int MaxNumber = 49;

    /// <summary>Display conversion rate; ports ETH_USD_RATE in js/lottery.js.</summary>
    public const decimal EthUsdRate = 3200m;

    public const decimal MinTicketUsd = 1m;
    public const decimal MaxCustomUsd = 6400m;

    public const int MaxQuantityPerPurchase = 100;
}

/// <summary>
/// Operator payout policy ported from js/pool-policy.js and docs/ADR/002-payout-policy.md.
/// The house retains the large majority of inflow; player payouts are capped.
/// </summary>
public static class PayoutPolicy
{
    public const decimal OperatorRetainRatio = 0.98m;
    public const decimal GlobalPayoutCapRatio = 0.02m;
    public const decimal DailyPayoutMinRatio = 0.01m;
    public const decimal DailyPayoutMaxRatio = 0.03m;

    public const string Description =
        "Player payouts are capped at 2% of pool inflow; the operator retains ~98%.";
}
