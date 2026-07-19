using NeonDraw.Domain.Enums;

namespace NeonDraw.Application.Draws;

public sealed record DrawSummaryDto(
    Guid Id,
    ulong OnChainDrawId,
    DrawTier Tier,
    DrawStatus Status,
    DateTimeOffset OpensAt,
    DateTimeOffset ClosesAt,
    decimal TicketPriceEth,
    decimal AdvertisedJackpotUsd,
    decimal PoolBalanceEth,
    int TicketCount,
    int WinnerCount
);

public interface IDrawReadService
{
    Task<IReadOnlyList<DrawSummaryDto>> GetDrawsAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<TicketSummaryDto>> GetTicketsByWalletAsync(string walletAddress, int limit = 100, CancellationToken cancellationToken = default);
}
