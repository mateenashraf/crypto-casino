using Microsoft.EntityFrameworkCore;
using NeonDraw.Domain.Entities;
using NeonDraw.Domain.Enums;
using NeonDraw.Infrastructure.Persistence;

namespace NeonDraw.Tests;

internal static class TestDb
{
    /// <summary>Creates an isolated in-memory context seeded with one open Daily draw (OnChainDrawId = 1).</summary>
    public static NeonDrawDbContext CreateSeeded(out Draw draw)
    {
        var options = new DbContextOptionsBuilder<NeonDrawDbContext>()
            .UseInMemoryDatabase($"neondraw-tests-{Guid.NewGuid()}")
            .Options;

        var db = new NeonDrawDbContext(options);

        draw = new Draw
        {
            Id = Guid.NewGuid(),
            OnChainDrawId = 1,
            Tier = DrawTier.Daily,
            Status = DrawStatus.Open,
            OpensAt = DateTimeOffset.UtcNow.AddHours(-1),
            ClosesAt = DateTimeOffset.UtcNow.AddHours(23),
            TicketPriceEth = 0.001m,
            AdvertisedJackpotUsd = 50_000m,
            PoolBalanceEth = 0m,
            TicketCount = 0,
            WinnerCount = 0
        };
        db.Draws.Add(draw);
        db.SaveChanges();
        return db;
    }
}
