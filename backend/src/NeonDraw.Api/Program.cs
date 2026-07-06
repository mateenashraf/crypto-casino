using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using NeonDraw.Application.Draws;
using NeonDraw.Application.Stats;
using NeonDraw.Application.Tickets;
using NeonDraw.Domain;
using NeonDraw.Infrastructure.Persistence;
using NeonDraw.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Serialize enums as strings for a friendlier API contract.
builder.Services.ConfigureHttpJsonOptions(options =>
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

// Provider selection: "InMemory" for dependency-free local dev/test (default in
// Development via appsettings.Development.json); PostgreSQL for other environments.
var provider = builder.Configuration["Database:Provider"] ?? "Postgres";
if (string.Equals(provider, "InMemory", StringComparison.OrdinalIgnoreCase))
{
    builder.Services.AddDbContext<NeonDrawDbContext>(options =>
        options.UseInMemoryDatabase("neondraw"));
}
else
{
    var connectionString = builder.Configuration.GetConnectionString("Default")
        ?? "Host=localhost;Port=5432;Database=neondraw;Username=neondraw;Password=neondraw";
    builder.Services.AddDbContext<NeonDrawDbContext>(options =>
        options.UseNpgsql(connectionString));
}

builder.Services.AddScoped<IDrawReadService, DrawReadService>();
builder.Services.AddScoped<IDrawService, DrawService>();
builder.Services.AddScoped<ITicketService, TicketService>();
builder.Services.AddScoped<IStatsService, StatsService>();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();

// Map LotteryValidationException to HTTP 400 with a JSON error body.
app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (LotteryValidationException ex)
    {
        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        await context.Response.WriteAsJsonAsync(new { error = ex.Message });
    }
});

app.MapGet("/health", () => Results.Ok(new { status = "healthy", service = "NeonDraw.Api" }));

app.MapGet("/api/draws", async (IDrawReadService draws, CancellationToken ct) =>
    Results.Ok(await draws.GetDrawsAsync(ct)))
.WithName("GetDraws").WithOpenApi();

app.MapGet("/api/draws/{onChainDrawId}", async (ulong onChainDrawId, IDrawService draws, CancellationToken ct) =>
{
    var draw = await draws.GetByIdAsync(onChainDrawId, ct);
    return draw is null ? Results.NotFound(new { error = $"Draw {onChainDrawId} not found." }) : Results.Ok(draw);
})
.WithName("GetDraw").WithOpenApi();

app.MapPost("/api/draws/{onChainDrawId}/settle", async (ulong onChainDrawId, IDrawService draws, CancellationToken ct) =>
    Results.Ok(await draws.SettleAsync(onChainDrawId, ct)))
.WithName("SettleDraw").WithOpenApi();

app.MapGet("/api/winners", async (int? limit, IDrawService draws, CancellationToken ct) =>
    Results.Ok(await draws.GetWinnersAsync(limit ?? 20, ct)))
.WithName("GetWinners").WithOpenApi();

app.MapPost("/api/tickets", async (PurchaseTicketRequest request, ITicketService tickets, CancellationToken ct) =>
    Results.Ok(await tickets.PurchaseAsync(request, ct)))
.WithName("PurchaseTicket").WithOpenApi();

app.MapGet("/api/tickets", async (string wallet, ITicketService tickets, CancellationToken ct) =>
    Results.Ok(await tickets.LookupByWalletAsync(wallet, ct)))
.WithName("LookupTickets").WithOpenApi();

app.MapGet("/api/stats", async (IStatsService stats, CancellationToken ct) =>
    Results.Ok(await stats.GetStatsAsync(ct)))
.WithName("GetStats").WithOpenApi();

app.MapGet("/api/pool-policy", (IStatsService stats) =>
    Results.Ok(stats.GetPayoutPolicy()))
.WithName("GetPoolPolicy").WithOpenApi();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<NeonDrawDbContext>();
    await db.Database.EnsureCreatedAsync();
    if (app.Environment.IsDevelopment())
        await NeonDrawDbContext.SeedDevelopmentDataAsync(db);
}

app.Run();

public partial class Program { }
