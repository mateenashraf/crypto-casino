namespace NeonDraw.Application.Draws;

public sealed record WinnerDto(
    string DrawId,
    string DrawName,
    string WalletDisplay,
    decimal PrizeUsd,
    string PrizeLabel,
    string PrizeType,
    int MatchCount,
    string Source,
    long Timestamp,
    string PayloadJson);

public interface IDrawSettlementService
{
    Task<int> TickAsync(CancellationToken ct = default);
    Task<IReadOnlyList<WinnerDto>> GetWinnersAsync(int limit = 50, CancellationToken ct = default);
}
