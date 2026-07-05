using Microsoft.EntityFrameworkCore;
using NeonDraw.Domain.Entities;
using NeonDraw.Domain.Enums;

namespace NeonDraw.Infrastructure.Persistence;

public class NeonDrawDbContext : DbContext
{
    public NeonDrawDbContext(DbContextOptions<NeonDrawDbContext> options) : base(options) { }

    public DbSet<Draw> Draws => Set<Draw>();
    public DbSet<Ticket> Tickets => Set<Ticket>();
    public DbSet<TransactionRecord> Transactions => Set<TransactionRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Draw>(entity =>
        {
            entity.HasKey(d => d.Id);
            entity.HasIndex(d => d.OnChainDrawId).IsUnique();
            entity.Property(d => d.TicketPriceEth).HasPrecision(28, 18);
            entity.Property(d => d.PoolBalanceEth).HasPrecision(28, 18);
            entity.Property(d => d.AdvertisedJackpotUsd).HasPrecision(18, 2);
        });

        modelBuilder.Entity<Ticket>(entity =>
        {
            entity.HasKey(t => t.Id);
            entity.HasIndex(t => t.OnChainTicketId).IsUnique();
            entity.HasIndex(t => t.WalletAddress);
            entity.Property(t => t.Numbers).HasColumnType("integer[]");
            entity.Property(t => t.PaidAmountUsd).HasPrecision(18, 2);
            entity.HasOne(t => t.Draw).WithMany(d => d.Tickets).HasForeignKey(t => t.DrawId);
        });

        modelBuilder.Entity<TransactionRecord>(entity =>
        {
            entity.HasKey(t => t.Id);
            entity.Property(t => t.AmountEth).HasPrecision(28, 18);
            entity.HasIndex(t => t.TxHash);
        });
    }

    public static async Task SeedDevelopmentDataAsync(NeonDrawDbContext db, CancellationToken cancellationToken = default)
    {
        if (await db.Draws.AnyAsync(cancellationToken))
            return;

        var now = DateTimeOffset.UtcNow;
        db.Draws.AddRange(
            new Draw
            {
                Id = Guid.NewGuid(),
                OnChainDrawId = 1,
                Tier = DrawTier.Daily,
                Status = DrawStatus.Open,
                OpensAt = now.AddHours(-2),
                ClosesAt = now.AddHours(22),
                TicketPriceEth = 0.001m,
                AdvertisedJackpotUsd = 50_000m,
                PoolBalanceEth = 0.12m,
                TicketCount = 120,
                WinnerCount = 3
            },
            new Draw
            {
                Id = Guid.NewGuid(),
                OnChainDrawId = 2,
                Tier = DrawTier.Weekly,
                Status = DrawStatus.Open,
                OpensAt = now.AddDays(-2),
                ClosesAt = now.AddDays(5),
                TicketPriceEth = 0.005m,
                AdvertisedJackpotUsd = 500_000m,
                PoolBalanceEth = 2.4m,
                TicketCount = 480,
                WinnerCount = 5
            }
        );

        await db.SaveChangesAsync(cancellationToken);
    }
}
