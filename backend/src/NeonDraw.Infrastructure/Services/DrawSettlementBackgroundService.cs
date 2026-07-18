using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using NeonDraw.Application.Draws;

namespace NeonDraw.Infrastructure.Services;

public class DrawSettlementBackgroundService : BackgroundService
{
    private readonly IServiceProvider _services;
    private readonly ILogger<DrawSettlementBackgroundService> _logger;

    public DrawSettlementBackgroundService(IServiceProvider services, ILogger<DrawSettlementBackgroundService> logger)
    {
        _services = services;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(8), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _services.CreateScope();
                var settlement = scope.ServiceProvider.GetRequiredService<IDrawSettlementService>();
                var count = await settlement.TickAsync(stoppingToken);
                if (count > 0) _logger.LogInformation("Settled {Count} draw tier(s)", count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Draw settlement tick failed");
            }

            await Task.Delay(TimeSpan.FromSeconds(45), stoppingToken);
        }
    }
}
