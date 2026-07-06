namespace NeonDraw.Application.Stats;

public sealed record PlatformStatsDto(
    decimal TotalPoolEth,
    decimal TotalPoolUsd,
    int TotalTickets,
    int TotalWinners,
    decimal TotalPaidOutUsd,
    int OpenDraws);

public sealed record PayoutPolicyDto(
    decimal OperatorRetainRatio,
    decimal GlobalPayoutCapRatio,
    decimal DailyPayoutMinRatio,
    decimal DailyPayoutMaxRatio,
    string Description);

public interface IStatsService
{
    Task<PlatformStatsDto> GetStatsAsync(CancellationToken cancellationToken = default);
    PayoutPolicyDto GetPayoutPolicy();
}
