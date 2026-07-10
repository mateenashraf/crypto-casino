using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using NeonDraw.Application.Draws;
using NeonDraw.Domain.Entities;
using NeonDraw.Infrastructure.Persistence;

namespace NeonDraw.Infrastructure.Services;

public class DrawSettlementService : IDrawSettlementService
{
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    private readonly NeonDrawDbContext _db;

    private static readonly (string Id, string Name, decimal AdvertisedPrize)[] Tiers =
    [
        ("daily", "Daily Draw", 3500m),
        ("weekly", "Weekly Mega", 2_000_000m),
        ("monthly", "Monthly Jackpot", 5_000_000m),
        ("quarterly", "Quarterly Ultra", 10_000_000m),
    ];

    public DrawSettlementService(NeonDrawDbContext db) => _db = db;

    public async Task<int> TickAsync(CancellationToken ct = default)
    {
        await EnsureSchedulesAsync(ct);
        var now = DateTimeOffset.UtcNow;
        var due = await _db.DrawTierSchedules.Where(s => s.NextDrawAt <= now).ToListAsync(ct);
        var settled = 0;

        foreach (var schedule in due)
        {
            var tier = Tiers.FirstOrDefault(t => t.Id == schedule.TierId);
            if (string.IsNullOrEmpty(tier.Id)) continue;

            await PublishShowcaseWinnerAsync(tier.Id, tier.Name, tier.AdvertisedPrize, ct);

            schedule.LastRunAt = now;
            schedule.RunCount += 1;
            schedule.NextDrawAt = NextDrawAt(tier.Id, now);
            settled++;
        }

        if (settled > 0) await _db.SaveChangesAsync(ct);
        return settled;
    }

    public async Task<IReadOnlyList<WinnerDto>> GetWinnersAsync(int limit = 50, CancellationToken ct = default)
    {
        var rows = await _db.PublishedWinners
            .AsNoTracking()
            .OrderByDescending(w => w.PublishedAt)
            .Take(Math.Clamp(limit, 1, 100))
            .ToListAsync(ct);

        return rows.Select(w => new WinnerDto(
            w.DrawTierId,
            w.DrawName,
            w.WalletDisplay,
            w.PrizeUsd,
            w.PrizeLabel,
            w.PrizeType,
            w.MatchCount,
            w.Source,
            w.PublishedAt.ToUnixTimeMilliseconds(),
            w.PayloadJson)).ToList();
    }

    private async Task EnsureSchedulesAsync(CancellationToken ct)
    {
        var existing = await _db.DrawTierSchedules.Select(s => s.TierId).ToListAsync(ct);
        var now = DateTimeOffset.UtcNow;
        var added = false;

        foreach (var tier in Tiers)
        {
            if (existing.Contains(tier.Id)) continue;
            _db.DrawTierSchedules.Add(new DrawTierSchedule
            {
                TierId = tier.Id,
                NextDrawAt = NextDrawAt(tier.Id, now),
                RunCount = 0,
            });
            added = true;
        }

        if (added) await _db.SaveChangesAsync(ct);
    }

    private async Task PublishShowcaseWinnerAsync(string tierId, string tierName, decimal advertised, CancellationToken ct)
    {
        var prizeUsd = RollShowcasePrize(tierId);
        var wallet = FakeWallet();
        var numbers = WinningNumbers();
        var payload = new
        {
            drawId = tierId,
            drawName = tierName,
            prize = prizeUsd,
            paidUsd = prizeUsd,
            prizeLabel = $"${prizeUsd:N0}",
            prizeType = "cash",
            matchCount = 4,
            jackpotTierWin = prizeUsd >= 10_000,
            microWin = prizeUsd < 10_000,
            numbers,
            winner = new { wallet, numbers = WinningNumbers() },
            source = "scheduled",
            fromRealTicket = false,
            timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
        };

        _db.PublishedWinners.Add(new PublishedWinner
        {
            Id = Guid.NewGuid(),
            DrawTierId = tierId,
            DrawName = tierName,
            WalletDisplay = wallet,
            PrizeUsd = prizeUsd,
            PrizeLabel = $"${prizeUsd:N0}",
            PrizeType = "cash",
            MatchCount = 4,
            Source = "scheduled",
            PayloadJson = JsonSerializer.Serialize(payload, JsonOpts),
            PublishedAt = DateTimeOffset.UtcNow,
        });
    }

    private static decimal RollShowcasePrize(string tierId) => tierId switch
    {
        "daily" => Random.Shared.Next(2800, 9500),
        "weekly" => Random.Shared.Next(18_000, 95_000),
        "monthly" => Random.Shared.Next(42_000, 285_000),
        "quarterly" => Random.Shared.Next(85_000, 520_000),
        _ => Random.Shared.Next(2000, 8000),
    };

    private static string FakeWallet()
    {
        static string Hex(int n) => string.Concat(Enumerable.Range(0, n).Select(_ => Random.Shared.Next(16).ToString("x")));
        return $"0x{Hex(4)}...{Hex(4)}";
    }

    private static int[] WinningNumbers()
    {
        var pool = Enumerable.Range(1, 49).ToList();
        var nums = new int[6];
        for (var i = 0; i < 6; i++)
        {
            var idx = Random.Shared.Next(pool.Count);
            nums[i] = pool[idx];
            pool.RemoveAt(idx);
        }
        Array.Sort(nums);
        return nums;
    }

    private static DateTimeOffset NextDrawAt(string tierId, DateTimeOffset from)
    {
        var n = from.UtcDateTime;
        return tierId switch
        {
            "daily" => new DateTimeOffset(n.Date.AddDays(1), TimeSpan.Zero),
            "weekly" => NextWeekly(n),
            "monthly" => new DateTimeOffset(new DateTime(n.Year, n.Month, 1).AddMonths(1).AddHours(21), TimeSpan.Zero),
            "quarterly" => NextQuarterly(n),
            _ => from.AddHours(24),
        };
    }

    private static DateTimeOffset NextWeekly(DateTime n)
    {
        var daysUntil = n.DayOfWeek == DayOfWeek.Sunday ? 7 : 7 - (int)n.DayOfWeek;
        var next = n.Date.AddDays(daysUntil).AddHours(20);
        if (next <= n) next = next.AddDays(7);
        return new DateTimeOffset(next, TimeSpan.Zero);
    }

    private static DateTimeOffset NextQuarterly(DateTime n)
    {
        var nextQuarterMonth = (n.Month - 1) / 3 * 3 + 3;
        var year = n.Year;
        if (nextQuarterMonth > 12) { nextQuarterMonth = 3; year++; }
        var next = new DateTime(year, nextQuarterMonth, 1, 22, 30, 0, DateTimeKind.Utc);
        if (next <= n) next = next.AddMonths(3);
        return new DateTimeOffset(next, TimeSpan.Zero);
    }
}
