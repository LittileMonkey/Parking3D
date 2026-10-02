param([string]$BaseUrl = 'http://localhost:5237', [switch]$WithDatabase)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Net.Http
$client = [System.Net.Http.HttpClient]::new()
function Request($method, $path, $expected, $body = $null, $token = $null) {
    $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($method), "$BaseUrl$path")
    if ($null -ne $body) { $request.Content = [System.Net.Http.StringContent]::new(($body | ConvertTo-Json), [System.Text.Encoding]::UTF8, 'application/json') }
    if ($token) { $request.Headers.Add('X-Booking-Token', $token) }
    $response = $client.SendAsync($request).GetAwaiter().GetResult()
    $content = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    if ([int]$response.StatusCode -ne $expected) { throw "$method $path expected $expected, got $([int]$response.StatusCode): $content" }
    Write-Host "PASS $method $path -> $expected"
    $response.Dispose()
    $request.Dispose()
    if ($content) { return ($content | ConvertFrom-Json) }
}
try {
    $null = Request GET '/health/live' 200
    $spec = Request GET '/openapi/v1.json' 200
    if (-not $spec.paths.'/api/bookings/guest') { throw 'Booking endpoint missing from OpenAPI' }
    $null = Request GET '/api/slots?pageSize=201' 400
    $null = Request POST '/api/bookings/guest' 400 @{ plate = ''; phone = 'bad'; vehicleType = 'UNKNOWN' }
    if ($WithDatabase) {
        $null = Request GET '/health/ready' 200
        $slots = Request GET '/api/slots?floor=F02&status=AVAILABLE&pageSize=1' 200
        if ($slots.items.Count -lt 1) { throw 'Need at least one available demo car slot' }
        $plate = 'TEST' + [Guid]::NewGuid().ToString('N').Substring(0,8)
        $body = @{ plate = $plate; phone = '0900000000'; vehicleType = 'CAR'; slotId = $slots.items[0].slotId }
        $created = Request POST '/api/bookings/guest' 201 $body
        try {
            $id = $created.booking.id
            $token = $created.accessToken
            if ($created.booking.status -ne 'CONFIRMED') { throw 'Expected CONFIRMED' }
            $null = Request GET "/api/bookings/$id" 401
            $null = Request GET "/api/bookings/$id" 404 $null 'invalid-token'
            $null = Request GET "/api/bookings/$id" 200 $null $token
            $null = Request POST '/api/bookings/guest' 409 $body
            $body.plate = 'TEST' + [Guid]::NewGuid().ToString('N').Substring(0,8)
            $null = Request POST '/api/bookings/guest' 409 $body
        } finally {
            $cancelled = Request POST "/api/bookings/$($created.booking.id)/cancel" 200 $null $created.accessToken
            if ($cancelled.status -ne 'CANCELLED') { throw 'Expected CANCELLED' }
        }
        $slot = Request GET "/api/slots/$($created.booking.slotId)" 200
        if ($slot.status -ne 'AVAILABLE') { throw 'Slot was not released' }
    }
} finally { $client.Dispose() }
