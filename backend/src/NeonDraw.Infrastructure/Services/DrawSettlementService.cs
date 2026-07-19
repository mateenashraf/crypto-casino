using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using NeonDraw.Application.Draws;
using NeonDraw.Domain.Entities;
using NeonDraw.Domain.Enums;
using NeonDraw.Infrastructure.Persistence;

namespace NeonDraw.Infrastructure.Services;

public class DrawSettlementService : IDrawSettlementService
{
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    private readonly NeonDrawDbContext _db;

    public DrawSettlementService(NeonDrawDbContext db) => _db = db;

    public async Task<int> TickAsync(CancellationToken ct = default)
    {
        var pending = await _db.PayoutRequests
            .Where(p => (p.Status == PayoutStatus.Approved || p.Status == PayoutStatus.AutoApproved)
                && p.Type == "draw_prize")
            .OrderBy(p => p.CreatedAt)
            .Take(100)
            .ToListAsync(ct);

        if (pending.Count == 0) return 0;

        foreach (var payout in pending)
        {
            var published = BuildPublishedWinnerFromPayout(payout);
            _db.PublishedWinners.Add(published);
            payout.Status = PayoutStatus.Paid;
            payout.ResolvedAt ??= DateTimeOffset.UtcNow;
            payout.ResolvedBy ??= "settlement-worker";
        }

        await _db.SaveChangesAsync(ct);
        return pending.Count;
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

    private static PublishedWinner BuildPublishedWinnerFromPayout(PayoutRequest payout)
    {
        var meta = ParseMeta(payout.MetaJson);
        var drawId = ReadString(meta, "drawId") ?? "unknown";
        var drawName = ReadString(meta, "drawName") ?? "On-chain Draw";
        var prizeType = ReadString(meta, "prizeType") ?? "cash";
        var matchCount = ReadInt(meta, "matchCount") ?? 0;
        var source = ReadString(meta, "source") ?? "onchain-settlement";
        var txHash = ReadString(meta, "txHash");

        var payload = new
        {
            payoutRequestId = payout.Id,
            payoutExternalId = payout.ExternalId,
            drawId,
            drawName,
            wallet = payout.WalletAddress,
            usdAmount = payout.UsdAmount,
            ethAmount = payout.EthAmount,
            prizeType,
            matchCount,
            source,
            txHash,
            timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
        };

        return new PublishedWinner
        {
            Id = Guid.NewGuid(),
            DrawTierId = drawId,
            DrawName = drawName,
            WalletDisplay = WalletDisplay(payout.WalletAddress),
            PrizeUsd = payout.UsdAmount,
            PrizeLabel = $"${payout.UsdAmount:N2}",
            PrizeType = prizeType,
            MatchCount = matchCount,
            Source = source,
            PayloadJson = JsonSerializer.Serialize(payload, JsonOpts),
            PublishedAt = DateTimeOffset.UtcNow,
        };
    }

    private static JsonElement? ParseMeta(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.Clone();
        }
        catch
        {
            return null;
        }
    }

    private static string WalletDisplay(string wallet)
    {
        if (string.IsNullOrWhiteSpace(wallet)) return "unknown";
        var clean = wallet.Trim();
        return clean.Length >= 10
            ? $"{clean[..6]}...{clean[^4..]}"
            : clean;
    }

    private static string? ReadString(JsonElement? root, string propertyName)
    {
        if (root is null || !root.Value.TryGetProperty(propertyName, out var node)) return null;
        return node.ValueKind == JsonValueKind.String ? node.GetString() : node.ToString();
    }

    private static int? ReadInt(JsonElement? root, string propertyName)
    {
        if (root is null || !root.Value.TryGetProperty(propertyName, out var node)) return null;
        return node.ValueKind switch
        {
            JsonValueKind.Number when node.TryGetInt32(out var i) => i,
            JsonValueKind.String when int.TryParse(node.GetString(), out var i) => i,
            _ => null,
        };
    }
}
