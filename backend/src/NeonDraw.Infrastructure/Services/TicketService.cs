using Microsoft.EntityFrameworkCore;
using NeonDraw.Application.Tickets;
using NeonDraw.Domain;
using NeonDraw.Domain.Entities;
using NeonDraw.Domain.Enums;
using NeonDraw.Infrastructure.Persistence;

namespace NeonDraw.Infrastructure.Services;

public class TicketService : ITicketService
{
    private readonly NeonDrawDbContext _db;

    public TicketService(NeonDrawDbContext db) => _db = db;

    public async Task<PurchaseResultDto> PurchaseAsync(
        PurchaseTicketRequest request, CancellationToken cancellationToken = default)
    {
        if (!LotteryRules.IsValidAddress(request.WalletAddress))
            throw new LotteryValidationException("A valid 0x wallet address is required.");

        LotteryRules.ValidateNumbers(request.Numbers);

        var quantity = request.Quantity;
        if (quantity < 1 || quantity > LotteryConstants.MaxQuantityPerPurchase)
            throw new LotteryValidationException(
                $"Quantity must be between 1 and {LotteryConstants.MaxQuantityPerPurchase}.");

        var draw = await _db.Draws.FirstOrDefaultAsync(d => d.OnChainDrawId == request.DrawId, cancellationToken)
            ?? throw new LotteryValidationException($"Draw {request.DrawId} was not found.");

        if (draw.Status != DrawStatus.Open)
            throw new LotteryValidationException($"Draw {request.DrawId} is not open for entries.");

        var wallet = LotteryRules.NormalizeAddress(request.WalletAddress);
        var numbers = LotteryRules.SortNumbers(request.Numbers);

        var unitEth = draw.TicketPriceEth;
        var unitUsd = decimal.Round(unitEth * LotteryConstants.EthUsdRate, 2);
        var totalEth = unitEth * quantity;
        var totalUsd = unitUsd * quantity;

        var nextOnChainId = (await _db.Tickets.MaxAsync(t => (ulong?)t.OnChainTicketId, cancellationToken)) ?? 0UL;

        var created = new List<Ticket>(quantity);
        for (var i = 0; i < quantity; i++)
        {
            var ticket = new Ticket
            {
                Id = Guid.NewGuid(),
                DrawId = draw.Id,
                OnChainTicketId = ++nextOnChainId,
                WalletAddress = wallet,
                Numbers = numbers,
                TxHash = request.TxHash,
                ChainId = request.ChainId,
                PurchasedAt = DateTimeOffset.UtcNow,
                IsWinner = false,
                PaidAmountUsd = unitUsd
            };
            created.Add(ticket);
        }

        _db.Tickets.AddRange(created);

        draw.TicketCount += quantity;
        draw.PoolBalanceEth += totalEth;

        _db.Transactions.Add(new TransactionRecord
        {
            Id = Guid.NewGuid(),
            Type = TransactionType.TicketPurchase,
            WalletAddress = wallet,
            AmountEth = totalEth,
            TxHash = request.TxHash,
            ChainId = request.ChainId,
            TicketId = created[0].Id,
            CreatedAt = DateTimeOffset.UtcNow
        });

        await _db.SaveChangesAsync(cancellationToken);

        var dtos = created.Select(t => ToDto(t, draw.OnChainDrawId, draw.Tier)).ToList();
        return new PurchaseResultDto(created.Count, totalUsd, totalEth, dtos);
    }

    public async Task<TicketLookupResultDto> LookupByWalletAsync(
        string wallet, CancellationToken cancellationToken = default)
    {
        if (!LotteryRules.IsValidAddress(wallet))
            throw new LotteryValidationException("A valid 0x wallet address is required.");

        var normalized = LotteryRules.NormalizeAddress(wallet);

        var rows = await (
            from t in _db.Tickets.AsNoTracking()
            join d in _db.Draws on t.DrawId equals d.Id
            where t.WalletAddress == normalized
            orderby t.PurchasedAt descending
            select new { t, d.OnChainDrawId, d.Tier })
            .ToListAsync(cancellationToken);

        var tickets = rows.Select(r => ToDto(r.t, r.OnChainDrawId, r.Tier)).ToList();
        var totalUsd = tickets.Sum(t => t.PaidAmountUsd ?? 0m);
        var totalEth = totalUsd == 0 ? 0m : decimal.Round(totalUsd / LotteryConstants.EthUsdRate, 18);

        return new TicketLookupResultDto(normalized, tickets.Count, totalUsd, totalEth, tickets);
    }

    internal static TicketDto ToDto(Ticket t, ulong onChainDrawId, DrawTier tier) => new(
        t.Id,
        onChainDrawId,
        tier,
        t.WalletAddress,
        t.Numbers,
        t.TxHash,
        t.ChainId,
        t.PurchasedAt,
        t.IsWinner,
        t.PaidAmountUsd);
}
