using NeonDraw.Application.Tickets;
using NeonDraw.Domain;
using NeonDraw.Infrastructure.Services;
using Xunit;

namespace NeonDraw.Tests;

public class TicketServiceTests
{
    private const string Wallet = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0";

    [Fact]
    public async Task Purchase_HappyPath_CreatesTicketsAndUpdatesPool()
    {
        using var db = TestDb.CreateSeeded(out var draw);
        var svc = new TicketService(db);

        var result = await svc.PurchaseAsync(new PurchaseTicketRequest(
            DrawId: 1, WalletAddress: Wallet, Numbers: new[] { 7, 14, 21, 28, 35, 42 }, Quantity: 3));

        Assert.Equal(3, result.TicketsCreated);
        Assert.Equal(3, result.Tickets.Count);
        Assert.Equal(0.003m, result.TotalEth);
        Assert.Equal(decimal.Round(0.001m * LotteryConstants.EthUsdRate, 2) * 3, result.TotalUsd);

        // numbers are stored sorted and lower-cased wallet
        Assert.Equal(new[] { 7, 14, 21, 28, 35, 42 }, result.Tickets[0].Numbers);
        Assert.Equal(Wallet.ToLowerInvariant(), result.Tickets[0].WalletAddress);

        // draw pool + count updated
        var updated = db.Draws.Single();
        Assert.Equal(3, updated.TicketCount);
        Assert.Equal(0.003m, updated.PoolBalanceEth);
        Assert.Single(db.Transactions);
    }

    [Fact]
    public async Task Purchase_InvalidNumbers_Throws()
    {
        using var db = TestDb.CreateSeeded(out _);
        var svc = new TicketService(db);

        await Assert.ThrowsAsync<LotteryValidationException>(() =>
            svc.PurchaseAsync(new PurchaseTicketRequest(1, Wallet, new[] { 1, 1, 2, 3, 4, 5 })));
    }

    [Fact]
    public async Task Purchase_UnknownDraw_Throws()
    {
        using var db = TestDb.CreateSeeded(out _);
        var svc = new TicketService(db);

        await Assert.ThrowsAsync<LotteryValidationException>(() =>
            svc.PurchaseAsync(new PurchaseTicketRequest(999, Wallet, new[] { 1, 2, 3, 4, 5, 6 })));
    }

    [Fact]
    public async Task Purchase_BadWallet_Throws()
    {
        using var db = TestDb.CreateSeeded(out _);
        var svc = new TicketService(db);

        await Assert.ThrowsAsync<LotteryValidationException>(() =>
            svc.PurchaseAsync(new PurchaseTicketRequest(1, "0xnope", new[] { 1, 2, 3, 4, 5, 6 })));
    }

    [Fact]
    public async Task Lookup_ReturnsTicketsForWallet()
    {
        using var db = TestDb.CreateSeeded(out _);
        var svc = new TicketService(db);
        await svc.PurchaseAsync(new PurchaseTicketRequest(1, Wallet, new[] { 1, 2, 3, 4, 5, 6 }, Quantity: 2));

        var lookup = await svc.LookupByWalletAsync(Wallet);

        Assert.Equal(2, lookup.TicketCount);
        Assert.Equal(Wallet.ToLowerInvariant(), lookup.WalletAddress);
        Assert.All(lookup.Tickets, t => Assert.Equal(Wallet.ToLowerInvariant(), t.WalletAddress));
    }
}
