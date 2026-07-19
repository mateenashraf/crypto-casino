using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using NeonDraw.Domain.Entities;
using NeonDraw.Domain.Enums;

namespace NeonDraw.Infrastructure.Persistence;

public class NeonDrawDbContext : DbContext
{
    public NeonDrawDbContext(DbContextOptions<NeonDrawDbContext> options) : base(options) { }

    public DbSet<Draw> Draws => Set<Draw>();
    public DbSet<Ticket> Tickets => Set<Ticket>();
    public DbSet<TransactionRecord> Transactions => Set<TransactionRecord>();
    public DbSet<ContactMessage> ContactMessages => Set<ContactMessage>();
    public DbSet<PayoutRequest> PayoutRequests => Set<PayoutRequest>();
    public DbSet<PublishedWinner> PublishedWinners => Set<PublishedWinner>();
    public DbSet<DrawTierSchedule> DrawTierSchedules => Set<DrawTierSchedule>();

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

        var numbersComparer = new ValueComparer<int[]>(
            (a, b) => (a ?? Array.Empty<int>()).SequenceEqual(b ?? Array.Empty<int>()),
            a => (a ?? Array.Empty<int>()).Aggregate(0, (h, v) => HashCode.Combine(h, v)),
            a => (a ?? Array.Empty<int>()).ToArray());

        modelBuilder.Entity<Ticket>(entity =>
        {
            entity.HasKey(t => t.Id);
            entity.HasIndex(t => t.OnChainTicketId).IsUnique();
            entity.HasIndex(t => t.WalletAddress);
            entity.Property(t => t.Numbers)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                    v => JsonSerializer.Deserialize<int[]>(v, (JsonSerializerOptions?)null) ?? Array.Empty<int>())
                .HasMaxLength(256)
                .Metadata.SetValueComparer(numbersComparer);
            entity.Property(t => t.PaidAmountUsd).HasPrecision(18, 2);
            entity.HasOne(t => t.Draw).WithMany(d => d.Tickets).HasForeignKey(t => t.DrawId);
        });

        modelBuilder.Entity<TransactionRecord>(entity =>
        {
            entity.HasKey(t => t.Id);
            entity.Property(t => t.AmountEth).HasPrecision(28, 18);
            entity.HasIndex(t => t.TxHash);
        });

        modelBuilder.Entity<ContactMessage>(entity =>
        {
            entity.HasKey(c => c.Id);
            entity.Property(c => c.Name).HasMaxLength(120);
            entity.Property(c => c.Email).HasMaxLength(254);
            entity.Property(c => c.Topic).HasMaxLength(80);
            entity.Property(c => c.Message).HasMaxLength(4000);
            entity.Property(c => c.WalletAddress).HasMaxLength(64);
            entity.HasIndex(c => c.CreatedAt);
        });

        modelBuilder.Entity<PayoutRequest>(entity =>
        {
            entity.HasKey(p => p.Id);
            entity.HasIndex(p => p.ExternalId).IsUnique();
            entity.HasIndex(p => p.Status);
            entity.HasIndex(p => p.WalletAddress);
            entity.Property(p => p.UsdAmount).HasPrecision(18, 2);
            entity.Property(p => p.EthAmount).HasPrecision(28, 18);
            entity.Property(p => p.WalletAddress).HasMaxLength(64);
            entity.Property(p => p.Type).HasMaxLength(40);
        });

        modelBuilder.Entity<PublishedWinner>(entity =>
        {
            entity.HasKey(w => w.Id);
            entity.HasIndex(w => w.PublishedAt);
            entity.Property(w => w.PrizeUsd).HasPrecision(18, 2);
        });

        modelBuilder.Entity<DrawTierSchedule>(entity =>
        {
            entity.HasKey(s => s.TierId);
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
