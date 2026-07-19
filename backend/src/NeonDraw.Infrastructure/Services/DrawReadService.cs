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

    public async Task<IReadOnlyList<TicketSummaryDto>> GetTicketsByWalletAsync(string walletAddress, int limit = 100, CancellationToken cancellationToken = default)
    {
        var normalized = walletAddress.Trim().ToLowerInvariant();
        var max = Math.Clamp(limit, 1, 200);

        return await _db.Tickets
            .AsNoTracking()
            .Include(t => t.Draw)
            .Where(t => t.WalletAddress.ToLower() == normalized)
            .OrderByDescending(t => t.PurchasedAt)
            .Take(max)
            .Select(t => new TicketSummaryDto(
                t.Id,
                t.OnChainTicketId,
                t.Draw.OnChainDrawId,
                t.Draw.Tier,
                t.Numbers,
                t.TxHash,
                t.ChainId,
                t.PurchasedAt,
                t.IsWinner,
                t.PaidAmountUsd))
            .ToListAsync(cancellationToken);
    }
}
