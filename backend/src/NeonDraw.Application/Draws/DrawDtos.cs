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
}

public sealed record WinnerDto(
    Guid Id,
    ulong DrawId,
    DrawTier Tier,
    string WalletAddress,
    int[] WinningNumbers,
    decimal PrizeUsd,
    bool IsSimulated,
    DateTimeOffset CreatedAt
);

public sealed record SettleResultDto(
    ulong DrawId,
    DrawStatus Status,
    int[] WinningNumbers,
    WinnerDto? Winner
);

public interface IDrawService
{
    Task<DrawSummaryDto?> GetByIdAsync(ulong onChainDrawId, CancellationToken cancellationToken = default);
    Task<SettleResultDto> SettleAsync(ulong onChainDrawId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<WinnerDto>> GetWinnersAsync(int limit = 20, CancellationToken cancellationToken = default);
}
