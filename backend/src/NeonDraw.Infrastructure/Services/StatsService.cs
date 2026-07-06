using Microsoft.EntityFrameworkCore;
using NeonDraw.Application.Stats;
using NeonDraw.Domain;
using NeonDraw.Domain.Enums;
using NeonDraw.Infrastructure.Persistence;

namespace NeonDraw.Infrastructure.Services;

public class StatsService : IStatsService
{
    private readonly NeonDrawDbContext _db;

    public StatsService(NeonDrawDbContext db) => _db = db;

    public async Task<PlatformStatsDto> GetStatsAsync(CancellationToken cancellationToken = default)
    {
        var totalPoolEth = await _db.Draws.SumAsync(d => (decimal?)d.PoolBalanceEth, cancellationToken) ?? 0m;
        var totalTickets = await _db.Tickets.CountAsync(cancellationToken);
        var totalWinners = await _db.Winners.CountAsync(cancellationToken);
        var totalPaidOutUsd = await _db.Winners.SumAsync(w => (decimal?)w.PrizeUsd, cancellationToken) ?? 0m;
        var openDraws = await _db.Draws.CountAsync(d => d.Status == DrawStatus.Open, cancellationToken);

        var totalPoolUsd = decimal.Round(totalPoolEth * LotteryConstants.EthUsdRate, 2);

        return new PlatformStatsDto(
            totalPoolEth,
            totalPoolUsd,
            totalTickets,
            totalWinners,
            decimal.Round(totalPaidOutUsd, 2),
            openDraws);
    }

    public PayoutPolicyDto GetPayoutPolicy() => new(
        PayoutPolicy.OperatorRetainRatio,
        PayoutPolicy.GlobalPayoutCapRatio,
        PayoutPolicy.DailyPayoutMinRatio,
        PayoutPolicy.DailyPayoutMaxRatio,
        PayoutPolicy.Description);
}
