using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using NeonDraw.Application.Payouts;
using NeonDraw.Domain.Entities;
using NeonDraw.Domain.Enums;
using NeonDraw.Infrastructure.Persistence;

namespace NeonDraw.Infrastructure.Services;

public class PayoutService : IPayoutService
{
    private const decimal AutoApproveMaxUsd = 1000m;
    private const decimal MaxPayoutUsd = 100_000m;
    private const decimal EthUsd = 3500m;

    private readonly NeonDrawDbContext _db;

    public PayoutService(NeonDrawDbContext db) => _db = db;

    public async Task<ProcessPayoutResponse> ProcessAsync(ProcessPayoutRequest request, CancellationToken ct = default)
    {
        var wallet = (request.Wallet ?? "").Trim();
        if (wallet.Length < 6) throw new ArgumentException("Invalid wallet");

        var usd = Math.Round(request.UsdAmount, 2);
        if (usd <= 0) throw new ArgumentException("Invalid amount");
        if (usd > MaxPayoutUsd) throw new ArgumentException("Amount exceeds maximum");

        var auto = usd < AutoApproveMaxUsd;
        var eth = Math.Round(usd / EthUsd, 8);
        var externalId = $"PAY-{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{Random.Shared.Next(1000, 9999)}";

        var entity = new PayoutRequest
        {
            Id = Guid.NewGuid(),
            ExternalId = externalId,
            WalletAddress = wallet,
            UsdAmount = usd,
            EthAmount = eth,
            Type = (request.Type ?? "draw_prize").Trim(),
                MetaJson = ValidateMetaJson(request.MetaJson),
            Status = auto ? PayoutStatus.AutoApproved : PayoutStatus.Pending,
            CreatedAt = DateTimeOffset.UtcNow,
        };

        _db.PayoutRequests.Add(entity);
        await _db.SaveChangesAsync(ct);

        return new ProcessPayoutResponse(
            auto,
            usd,
            entity.Id,
            entity.ExternalId,
            entity.Status);
    }

    public async Task<IReadOnlyList<PayoutSummaryDto>> GetPendingAsync(CancellationToken ct = default)
    {
        return await _db.PayoutRequests
            .AsNoTracking()
            .Where(p => p.Status == PayoutStatus.Pending)
            .OrderByDescending(p => p.CreatedAt)
            .Take(100)
            .Select(p => ToDto(p))
            .ToListAsync(ct);
    }

    public async Task<PayoutSummaryDto?> ApproveAsync(Guid id, string operatorId, CancellationToken ct = default)
    {
        var entity = await _db.PayoutRequests.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (entity is null || entity.Status != PayoutStatus.Pending) return null;

        entity.Status = PayoutStatus.Approved;
        entity.ResolvedAt = DateTimeOffset.UtcNow;
        entity.ResolvedBy = operatorId;
        await _db.SaveChangesAsync(ct);
        return ToDto(entity);
    }

    public async Task<PayoutSummaryDto?> RejectAsync(Guid id, string operatorId, CancellationToken ct = default)
    {
        var entity = await _db.PayoutRequests.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (entity is null || entity.Status != PayoutStatus.Pending) return null;

        entity.Status = PayoutStatus.Rejected;
        entity.ResolvedAt = DateTimeOffset.UtcNow;
        entity.ResolvedBy = operatorId;
        await _db.SaveChangesAsync(ct);
        return ToDto(entity);
    }

    private static PayoutSummaryDto ToDto(PayoutRequest p) => new(
        p.Id,
        p.ExternalId,
        p.WalletAddress,
        p.UsdAmount,
        p.Type,
        p.Status,
        p.CreatedAt,
        p.MetaJson);

    private static string? ValidateMetaJson(string? json)
    {
        if (json is null) return null;
        if (json.Length > 4096) throw new ArgumentException("MetaJson too large");
        try { using var doc = JsonDocument.Parse(json); }
        catch { throw new ArgumentException("Invalid MetaJson"); }
        return json;
    }
}
