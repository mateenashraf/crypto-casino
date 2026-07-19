using NeonDraw.Domain.Enums;

namespace NeonDraw.Application.Draws;

public sealed record TicketSummaryDto(
    Guid Id,
    ulong OnChainTicketId,
    ulong OnChainDrawId,
    DrawTier Tier,
    int[] Numbers,
    string? TxHash,
    int ChainId,
    DateTimeOffset PurchasedAt,
    bool IsWinner,
    decimal? PaidAmountUsd);
