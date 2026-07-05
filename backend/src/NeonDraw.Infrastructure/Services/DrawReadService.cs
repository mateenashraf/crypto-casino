using Microsoft.EntityFrameworkCore;
using NeonDraw.Application.Draws;
using NeonDraw.Infrastructure.Persistence;

namespace NeonDraw.Infrastructure.Services;

public class DrawReadService : IDrawReadService
{
    private readonly NeonDrawDbContext _db;

    public DrawReadService(NeonDrawDbContext db) => _db = db;

    public async Task<IReadOnlyList<DrawSummaryDto>> GetDrawsAsync(CancellationToken cancellationToken = default)
    {
        return await _db.Draws
            .AsNoTracking()
            .OrderBy(d => d.ClosesAt)
            .Select(d => new DrawSummaryDto(
                d.Id,
                d.OnChainDrawId,
                d.Tier,
                d.Status,
                d.OpensAt,
                d.ClosesAt,
                d.TicketPriceEth,
                d.AdvertisedJackpotUsd,
                d.PoolBalanceEth,
                d.TicketCount,
                d.WinnerCount))
            .ToListAsync(cancellationToken);
    }
}
