using Microsoft.EntityFrameworkCore;
using Npgsql;
using ParkingSystem.Data;

await using var db = new ParkingDbContextFactory().CreateDbContext([]);
var connection = (NpgsqlConnection)db.Database.GetDbConnection();
await connection.OpenAsync();
Console.WriteLine($"Database: {connection.Database}; Server: {connection.Host}:{connection.Port}");
await using var command = connection.CreateCommand();
command.CommandText = "SELECT table_schema || '.' || table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') AND table_type = 'BASE TABLE' ORDER BY 1";
await using (var reader = await command.ExecuteReaderAsync())
{
    var count = 0;
    while (await reader.ReadAsync()) { Console.WriteLine(reader.GetString(0)); count++; }
    Console.WriteLine($"Existing tables: {count}");
}
var shadows = db.Model.GetEntityTypes().SelectMany(e => e.GetProperties().Where(p => p.IsShadowProperty()).Select(p => e.Name + "." + p.Name)).ToList();
if (shadows.Count != 0) throw new InvalidOperationException("Unexpected shadow properties: " + string.Join(", ", shadows));
Console.WriteLine($"EF entity count: {db.Model.GetEntityTypes().Count()}; shadow properties: 0");
if (args.Contains("--verify")) await ConstraintChecks.Run(db, connection);
