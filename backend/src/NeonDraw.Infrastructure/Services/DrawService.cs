using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using NeonDraw.Application.Draws;
using NeonDraw.Domain;
using NeonDraw.Domain.Entities;
using NeonDraw.Domain.Enums;
using NeonDraw.Infrastructure.Persistence;

namespace NeonDraw.Infrastructure.Services;

/// <summary>
/// Write-side draw operations: settle a draw and read winner history.
/// Ports js/draw-engine.js runDraw + economics, but server-side and using a
/// cryptographic RNG instead of Math.random(). NOTE: production draws should use
/// on-chain verifiable randomness (Chainlink VRF) per docs/ARCHITECTURE.md.
/// </summary>
public class DrawService : IDrawService
{
    private readonly NeonDrawDbContext _db;

    public DrawService(NeonDrawDbContext db) => _db = db;

    public async Task<DrawSummaryDto?> GetByIdAsync(ulong onChainDrawId, CancellationToken cancellationToken = default)
    {
        return await _db.Draws
            .AsNoTracking()
            .Where(d => d.OnChainDrawId == onChainDrawId)
            .Select(d => new DrawSummaryDto(
                d.Id, d.OnChainDrawId, d.Tier, d.Status, d.OpensAt, d.ClosesAt,
                d.TicketPriceEth, d.AdvertisedJackpotUsd, d.PoolBalanceEth, d.TicketCount, d.WinnerCount))
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<SettleResultDto> SettleAsync(ulong onChainDrawId, CancellationToken cancellationToken = default)
    {
        var draw = await _db.Draws.FirstOrDefaultAsync(d => d.OnChainDrawId == onChainDrawId, cancellationToken)
            ?? throw new LotteryValidationException($"Draw {onChainDrawId} was not found.");

        if (draw.Status == DrawStatus.Settled)
        {
            var existing = await _db.Winners.AsNoTracking()
                .Where(w => w.DrawId == draw.Id)
                .OrderByDescending(w => w.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);
            var winningNums = existing?.WinningNumbers ?? Array.Empty<int>();
            return new SettleResultDto(draw.OnChainDrawId, draw.Status, winningNums,
                existing is null ? null : ToWinnerDto(existing, draw));
        }

        var winningNumbers = DrawWinningNumbers();

        var tickets = await _db.Tickets
            .Where(t => t.DrawId == draw.Id)
            .ToListAsync(cancellationToken);

        // Payout is capped by policy: 2% of the pool inflow (USD).
        var poolUsd = draw.PoolBalanceEth * LotteryConstants.EthUsdRate;
        var prizeUsd = decimal.Round(poolUsd * PayoutPolicy.GlobalPayoutCapRatio, 2);

        Winner winner;
        if (tickets.Count > 0)
        {
            var chosen = tickets[RandomNumberGenerator.GetInt32(tickets.Count)];
            chosen.IsWinner = true;
            winner = new Winner
            {
                Id = Guid.NewGuid(),
                DrawId = draw.Id,
                TicketId = chosen.Id,
                WalletAddress = chosen.WalletAddress,
                WinningNumbers = winningNumbers,
                PrizeUsd = prizeUsd,
                IsSimulated = false,
                CreatedAt = DateTimeOffset.UtcNow
            };
        }
        else
        {
            winner = new Winner
            {
                Id = Guid.NewGuid(),
                DrawId = draw.Id,
                TicketId = null,
                WalletAddress = FakeWallet(),
                WinningNumbers = winningNumbers,
                PrizeUsd = 0m,
                IsSimulated = true,
                CreatedAt = DateTimeOffset.UtcNow
            };
        }

        _db.Winners.Add(winner);
        draw.Status = DrawStatus.Settled;
        draw.SettledAt = DateTimeOffset.UtcNow;
        draw.WinnerCount = 1;

        await _db.SaveChangesAsync(cancellationToken);

        return new SettleResultDto(draw.OnChainDrawId, draw.Status, winningNumbers, ToWinnerDto(winner, draw));
    }

    public async Task<IReadOnlyList<WinnerDto>> GetWinnersAsync(int limit = 20, CancellationToken cancellationToken = default)
    {
        if (limit < 1) limit = 1;
        if (limit > 100) limit = 100;

        var rows = await (
            from w in _db.Winners.AsNoTracking()
            join d in _db.Draws on w.DrawId equals d.Id
            orderby w.CreatedAt descending
            select new { w, d.OnChainDrawId, d.Tier })
            .Take(limit)
            .ToListAsync(cancellationToken);

        return rows.Select(r => new WinnerDto(
            r.w.Id, r.OnChainDrawId, r.Tier, r.w.WalletAddress,
            r.w.WinningNumbers, r.w.PrizeUsd, r.w.IsSimulated, r.w.CreatedAt)).ToList();
    }

    private static WinnerDto ToWinnerDto(Winner w, Draw draw) => new(
        w.Id, draw.OnChainDrawId, draw.Tier, w.WalletAddress,
        w.WinningNumbers, w.PrizeUsd, w.IsSimulated, w.CreatedAt);

    private static int[] DrawWinningNumbers()
    {
        var pool = Enumerable.Range(LotteryConstants.MinNumber,
            LotteryConstants.MaxNumber - LotteryConstants.MinNumber + 1).ToList();
        var picked = new List<int>(LotteryConstants.NumbersPerTicket);
        for (var i = 0; i < LotteryConstants.NumbersPerTicket; i++)
        {
            var idx = RandomNumberGenerator.GetInt32(pool.Count);
            picked.Add(pool[idx]);
            pool.RemoveAt(idx);
        }
        picked.Sort();
        return picked.ToArray();
    }

    private static string FakeWallet()
    {
        Span<byte> bytes = stackalloc byte[20];
        RandomNumberGenerator.Fill(bytes);
        return "0x" + Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
