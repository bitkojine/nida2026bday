using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;

var builder = WebApplication.CreateBuilder(args);

var allowedOrigins = (Environment.GetEnvironmentVariable("FRONTEND_ORIGIN") ?? string.Empty)
  .Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);

builder.Services.AddCors(options =>
{
  options.AddPolicy("frontend", policy =>
  {
    if (allowedOrigins.Length > 0)
    {
      policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod();
      return;
    }

    policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod();
  });
});

var app = builder.Build();
app.UseCors("frontend");

var references = LoadMetadataReferences();

app.MapGet("/health", () => Results.Ok(new { ok = true, compiler = "Roslyn C#" }));

app.MapPost("/api/csharp/compile", (CompileRequest request, HttpContext httpContext) =>
{
  if (string.IsNullOrWhiteSpace(request.Source))
  {
    return Results.BadRequest(new CompileResponse(
      Valid: false,
      Diagnostics: ["Kodas tuščias."],
      Compiler: "Roslyn C#",
      CheckedAtUtc: DateTime.UtcNow.ToString("O")
    ));
  }

  if (request.Source.Length > 50_000)
  {
    return Results.BadRequest(new CompileResponse(
      Valid: false,
      Diagnostics: ["Kodas per ilgas. Maksimalus ilgis: 50000 simbolių."],
      Compiler: "Roslyn C#",
      CheckedAtUtc: DateTime.UtcNow.ToString("O")
    ));
  }

  using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(5));
  using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
    timeoutCts.Token,
    httpContext.RequestAborted
  );

  var syntaxTree = CSharpSyntaxTree.ParseText(request.Source);
  var compilation = CSharpCompilation.Create(
    assemblyName: $"PlayerCode_{Guid.NewGuid():N}",
    syntaxTrees: [syntaxTree],
    references: references,
    options: new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary)
  );

  var diagnostics = compilation
    .GetDiagnostics(linkedCts.Token)
    .Where(d => d.Severity == DiagnosticSeverity.Error)
    .Select(FormatDiagnostic)
    .Take(30)
    .ToArray();

  var response = new CompileResponse(
    Valid: diagnostics.Length == 0,
    Diagnostics: diagnostics,
    Compiler: "Roslyn C#",
    CheckedAtUtc: DateTime.UtcNow.ToString("O")
  );
  return Results.Ok(response);
});

app.Run();

static MetadataReference[] LoadMetadataReferences()
{
  var trusted = AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES") as string;
  if (string.IsNullOrWhiteSpace(trusted))
  {
    return [MetadataReference.CreateFromFile(typeof(object).Assembly.Location)];
  }

  return trusted
    .Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries)
    .Select(path => MetadataReference.CreateFromFile(path))
    .ToArray();
}

static string FormatDiagnostic(Diagnostic diagnostic)
{
  var lineSpan = diagnostic.Location.GetLineSpan();
  var line = lineSpan.StartLinePosition.Line + 1;
  var column = lineSpan.StartLinePosition.Character + 1;
  return $"{diagnostic.Id} ({line},{column}): {diagnostic.GetMessage()}";
}

internal record CompileRequest(string Source);

internal record CompileResponse(
  bool Valid,
  string[] Diagnostics,
  string Compiler,
  string CheckedAtUtc
);
