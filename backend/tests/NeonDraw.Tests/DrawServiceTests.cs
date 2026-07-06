using NeonDraw.Application.Tickets;
using NeonDraw.Domain;
using NeonDraw.Domain.Enums;
using NeonDraw.Infrastructure.Services;
using Xunit;

namespace NeonDraw.Tests;

public class DrawServiceTests
{
    private const string Wallet = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0";

    [Fact]
    public async Task Settle_WithTickets_PicksRealWinner_AndCapsPrize()
    {
        using var db = TestDb.CreateSeeded(out var draw);
        var tickets = new TicketService(db);
        await tickets.PurchaseAsync(new PurchaseTicketRequest(1, Wallet, new[] { 1, 2, 3, 4, 5, 6 }, Quantity: 10));

        var draws = new DrawService(db);
        var result = await draws.SettleAsync(1);

        Assert.Equal(DrawStatus.Settled, result.Status);
        Assert.Equal(6, result.WinningNumbers.Length);
        Assert.NotNull(result.Winner);
        Assert.False(result.Winner!.IsSimulated);
        Assert.Equal(Wallet.ToLowerInvariant(), result.Winner.WalletAddress);

        // prize capped at 2% of pool USD (10 * 0.001 ETH * 3200 = $32 -> 2% = $0.64)
        var poolUsd = 10 * 0.001m * LotteryConstants.EthUsdRate;
        Assert.Equal(decimal.Round(poolUsd * PayoutPolicy.GlobalPayoutCapRatio, 2), result.Winner.PrizeUsd);

        var settled = db.Draws.Single();
        Assert.Equal(DrawStatus.Settled, settled.Status);
        Assert.NotNull(settled.SettledAt);
    }

    [Fact]
    public async Task Settle_NoTickets_ProducesSimulatedWinner()
    {
        using var db = TestDb.CreateSeeded(out _);
        var draws = new DrawService(db);

        var result = await draws.SettleAsync(1);

        Assert.Equal(DrawStatus.Settled, result.Status);
        Assert.NotNull(result.Winner);
        Assert.True(result.Winner!.IsSimulated);
        Assert.Equal(0m, result.Winner.PrizeUsd);
    }

    [Fact]
    public async Task Settle_IsIdempotent_OnAlreadySettledDraw()
    {
        using var db = TestDb.CreateSeeded(out _);
        var draws = new DrawService(db);

        await draws.SettleAsync(1);
        var second = await draws.SettleAsync(1);

        Assert.Equal(DrawStatus.Settled, second.Status);
        Assert.Single(db.Winners); // no duplicate winner created
    }

    [Fact]
    public async Task GetWinners_ReturnsSettledWinners()
    {
        using var db = TestDb.CreateSeeded(out _);
        var draws = new DrawService(db);
        await draws.SettleAsync(1);

        var winners = await draws.GetWinnersAsync();

        Assert.Single(winners);
        Assert.Equal(DrawTier.Daily, winners[0].Tier);
    }
}
