using Microsoft.EntityFrameworkCore;
using NeonDraw.Application.Draws;
using NeonDraw.Infrastructure.Persistence;
using NeonDraw.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? "Host=localhost;Port=5432;Database=neondraw;Username=neondraw;Password=neondraw";

builder.Services.AddDbContext<NeonDrawDbContext>(options =>
    options.UseNpgsql(connectionString));

builder.Services.AddScoped<IDrawReadService, DrawReadService>();

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

app.MapGet("/health", () => Results.Ok(new { status = "healthy", service = "NeonDraw.Api" }));

app.MapGet("/api/draws", async (IDrawReadService draws, CancellationToken ct) =>
{
    var items = await draws.GetDrawsAsync(ct);
    return Results.Ok(items);
})
.WithName("GetDraws")
.WithOpenApi();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<NeonDrawDbContext>();
    await db.Database.EnsureCreatedAsync();
    if (app.Environment.IsDevelopment())
        await NeonDrawDbContext.SeedDevelopmentDataAsync(db);
}

app.Run();
