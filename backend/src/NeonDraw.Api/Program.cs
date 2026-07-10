using Microsoft.EntityFrameworkCore;
using NeonDraw.Application.Contact;
using NeonDraw.Application.Draws;
using NeonDraw.Application.Payouts;
using NeonDraw.Domain.Entities;
using NeonDraw.Infrastructure.Persistence;
using NeonDraw.Infrastructure.Services;
using System.Collections.Concurrent;
using System.Net.Mail;
using System.Text.Json;
using System.Text.RegularExpressions;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? Environment.GetEnvironmentVariable("NEONDRAW_DB")
    ?? "Host=localhost;Port=5432;Database=neondraw;Username=neondraw;Password=neondraw";

builder.Services.AddDbContext<NeonDrawDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddScoped<IDrawReadService, DrawReadService>();
builder.Services.AddScoped<IPayoutService, PayoutService>();
builder.Services.AddScoped<IDrawSettlementService, DrawSettlementService>();
builder.Services.AddHostedService<DrawSettlementBackgroundService>();

var allowedOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>()
    ?? new[] { "http://localhost:8080", "http://127.0.0.1:8080", "https://neondraw.com" };

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        if (builder.Environment.IsDevelopment())
            policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
        else
            policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod();
    });
});

var app = builder.Build();

string? AdminKey() =>
    builder.Configuration["Admin:ApiKey"]
    ?? Environment.GetEnvironmentVariable("NEONDRAW_ADMIN_KEY");

bool IsAdmin(HttpContext ctx) =>
    !string.IsNullOrEmpty(AdminKey())
    && string.Equals(ctx.Request.Headers["X-Admin-Key"], AdminKey(), StringComparison.Ordinal);

app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    context.Response.Headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()";
    context.Response.Headers.Remove("Server");
    context.Response.Headers.Remove("X-Powered-By");
    await next();
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();

app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

app.MapGet("/api/draws", async (IDrawReadService draws, CancellationToken ct) =>
{
    var items = await draws.GetDrawsAsync(ct);
    return Results.Ok(items);
})
.WithName("GetDraws")
.WithOpenApi();

app.MapGet("/api/draws/winners", async (IDrawSettlementService settlement, int? limit, CancellationToken ct) =>
{
    var items = await settlement.GetWinnersAsync(limit ?? 50, ct);
    return Results.Ok(items);
})
.WithName("GetWinners")
.WithOpenApi();

var contactRate = new ConcurrentDictionary<string, (int Count, DateTimeOffset WindowStart)>();
const int contactLimitPerHour = 5;

app.MapPost("/api/contact", async (ContactRequest req, HttpContext http, NeonDrawDbContext db, CancellationToken ct) =>
{
    var ip = http.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    var now = DateTimeOffset.UtcNow;
    var bucket = contactRate.AddOrUpdate(ip, _ => (1, now), (_, prev) =>
    {
        if (now - prev.WindowStart > TimeSpan.FromHours(1)) return (1, now);
        return (prev.Count + 1, prev.WindowStart);
    });
    if (bucket.Count > contactLimitPerHour)
        return Results.Json(new { title = "Too many requests", detail = "Please try again later." }, statusCode: 429);

    var name = (req.Name ?? "").Trim();
    var email = (req.Email ?? "").Trim();
    var topic = (req.Topic ?? "general").Trim();
    var message = (req.Message ?? "").Trim();
    var wallet = string.IsNullOrWhiteSpace(req.Wallet) ? null : req.Wallet.Trim();

    if (name.Length < 2 || name.Length > 120)
        return Results.BadRequest(new { title = "Invalid name" });
    if (message.Length < 10 || message.Length > 4000)
        return Results.BadRequest(new { title = "Invalid message" });
    if (!Regex.IsMatch(email, @"^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.IgnoreCase))
        return Results.BadRequest(new { title = "Invalid email" });

    try { _ = new MailAddress(email); }
    catch { return Results.BadRequest(new { title = "Invalid email" }); }

    if (wallet != null && wallet.Length > 64)
        return Results.BadRequest(new { title = "Invalid wallet" });

    db.ContactMessages.Add(new ContactMessage
    {
        Id = Guid.NewGuid(),
        Name = name,
        Email = email,
        Topic = topic.Length > 80 ? topic[..80] : topic,
        Message = message,
        WalletAddress = wallet,
        ClientIp = ip,
        CreatedAt = now,
    });
    await db.SaveChangesAsync(ct);

    return Results.Ok(new ContactResponse(true));
})
.WithName("SubmitContact")
.WithOpenApi();

var payoutRate = new ConcurrentDictionary<string, (int Count, DateTimeOffset WindowStart)>();

app.MapPost("/api/payouts/process", async (ProcessPayoutRequest req, HttpContext http, IPayoutService payouts, CancellationToken ct) =>
{
    var ip = http.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    var now = DateTimeOffset.UtcNow;
    var bucket = payoutRate.AddOrUpdate(ip, _ => (1, now), (_, prev) =>
    {
        if (now - prev.WindowStart > TimeSpan.FromMinutes(10)) return (1, now);
        return (prev.Count + 1, prev.WindowStart);
    });
    if (bucket.Count > 30)
        return Results.Json(new { title = "Too many requests" }, statusCode: 429);

    try
    {
        var result = await payouts.ProcessAsync(req, ct);
        return Results.Ok(result);
    }
    catch (ArgumentException ex)
    {
        return Results.BadRequest(new { title = ex.Message });
    }
})
.WithName("ProcessPayout")
.WithOpenApi();

app.MapGet("/api/admin/payouts/pending", async (HttpContext ctx, IPayoutService payouts, CancellationToken ct) =>
{
    if (!IsAdmin(ctx)) return Results.Unauthorized();
    return Results.Ok(await payouts.GetPendingAsync(ct));
})
.WithName("AdminGetPendingPayouts")
.WithOpenApi();

app.MapPost("/api/admin/payouts/{id:guid}/approve", async (Guid id, HttpContext ctx, IPayoutService payouts, CancellationToken ct) =>
{
    if (!IsAdmin(ctx)) return Results.Unauthorized();
    var op = ctx.Request.Headers["X-Admin-Operator"].FirstOrDefault() ?? "admin";
    var result = await payouts.ApproveAsync(id, op, ct);
    return result is null ? Results.NotFound() : Results.Ok(result);
})
.WithName("AdminApprovePayout")
.WithOpenApi();

app.MapPost("/api/admin/payouts/{id:guid}/reject", async (Guid id, HttpContext ctx, IPayoutService payouts, CancellationToken ct) =>
{
    if (!IsAdmin(ctx)) return Results.Unauthorized();
    var op = ctx.Request.Headers["X-Admin-Operator"].FirstOrDefault() ?? "admin";
    var result = await payouts.RejectAsync(id, op, ct);
    return result is null ? Results.NotFound() : Results.Ok(result);
})
.WithName("AdminRejectPayout")
.WithOpenApi();

app.MapPost("/api/admin/draws/tick", async (HttpContext ctx, IDrawSettlementService settlement, CancellationToken ct) =>
{
    if (!IsAdmin(ctx)) return Results.Unauthorized();
    var count = await settlement.TickAsync(ct);
    return Results.Ok(new { settled = count });
})
.WithName("AdminDrawTick")
.WithOpenApi();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<NeonDrawDbContext>();
    await db.Database.EnsureCreatedAsync();
    if (app.Environment.IsDevelopment())
        await NeonDrawDbContext.SeedDevelopmentDataAsync(db);
}

app.Run();
