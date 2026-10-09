
var builder = WebApplication.CreateBuilder(args);

var app = builder.Build();

app.UseHttpsRedirection();

// Enable default index.html
app.UseDefaultFiles();

// Serve HTML, CSS, JavaScript
app.UseStaticFiles();

app.Run();
