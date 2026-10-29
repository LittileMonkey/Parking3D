// Real local services and fresh databases. No mock payment/event injection.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), net = require('node:net');
const { spawn, execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../..'), out = path.join(root, 'artifacts/qa/sprint-3/api-' + new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
let pgVersion = 'not-started';
const pgPort = Number(process.env.QA_PG_PORT || 55486);
const processes = [], observations = [], clients = [];
const { Client } = require('pg');
let native;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const secret = crypto.randomBytes(32).toString('hex'), password = 'Local-' + crypto.randomBytes(12).toString('hex') + '!aA1';
const lot = '11111111-1111-4111-8111-111111111111', slot = '77777777-7777-4777-8777-777777777777', vehicle = '99999999-9999-4999-8999-999999999999', gate = '12345678-1234-4234-8234-123456789003';
function safe(value, key = '') { if (/token|password|qrPayload|plate|phone|hash|paymentUrl/i.test(key))
    return '[REDACTED]'; if (Array.isArray(value))
    return value.map(v => safe(v)); if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, safe(v, k)])); return value; }
async function free(port) { await new Promise((resolve, reject) => { const s = net.createServer(); s.once('error', () => reject(new Error('Port already used: ' + port))); s.listen(port, '127.0.0.1', () => s.close(resolve)); }); }
function host(service, http, grpc, connection, extra = {}) { const name = service === 'ai' ? 'AI' : service[0].toUpperCase() + service.slice(1); const project = service === 'gateway' ? 'src/Gateway/Parking.Gateway' : `src/Services/${name}/Parking.${name}.Api`; const dll = service === 'gateway' ? 'Parking.Gateway.dll' : `Parking.${name}.Api.dll`; const env = { ...process.env, DOTNET_ROLL_FORWARD: 'Major', ASPNETCORE_ENVIRONMENT: 'Development', ASPNETCORE_URLS: `http://127.0.0.1:${http}`, Ports__Http: String(http), Ports__Grpc: String(grpc), Jwt__Key: secret, Jwt__Issuer: 'parking-identity', Jwt__Audience: 'parking-api', Jwt__AccessTokenExpirationMinutes: '30', Grpc__ServiceKey: secret, Qr__SigningKey: secret, ConnectionStrings__Service: connection, ConnectionStrings__DefaultConnectionString: connection, Services__IdentityGrpc: 'http://127.0.0.1:5042', Services__ParkingGrpc: 'http://127.0.0.1:56522', Services__AIGrpc: 'http://127.0.0.1:56542', Logging__LogLevel__Default: 'Warning', SeedAdmin__Email: 'admin@qa.example.test', SeedAdmin__Password: password, SeedAdmin__FullName: 'Synthetic QA Admin', SeedStaff__Email: 'staff@qa.example.test', SeedStaff__Password: password, SeedStaff__FullName: 'Synthetic QA Staff', ...extra }; const log = fs.openSync(path.join(out, service + '-demo.log'), 'w'); const p = spawn('dotnet', [path.join(root, project, 'bin/Debug/net9.0', dll)], { cwd: path.join(root, project), env, windowsHide: true, stdio: ['ignore', log, log] }); processes.push(p); return p; }
async function ready(url) { for (let i = 0; i < 60; i++) {
    try {
        if ((await fetch(url, { signal: AbortSignal.timeout(5000) })).ok)
            return;
    }
    catch { }
    await sleep(500);
} throw new Error('Readiness timeout: ' + url); }
async function call(label, url, method = 'GET', body, token, key, expected = 200) { const response = await fetch(url, { method, headers: { 'content-type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(key ? { 'Idempotency-Key': key } : {}) }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) }); let json; try {
    json = await response.json();
}
catch {
    json = { message: 'Non-JSON response' };
} observations.push({ label, status: response.status, expected, response: safe(json) }); console.log(label + ': ' + response.status); if (expected !== null && response.status !== expected)
    throw new Error(label + ': expected ' + expected + ', received ' + response.status); return json.result ?? json; }
(async () => {
    try {
        for (const port of [pgPort, 5041, 5042, 7023, 56500, 56521, 56522, 56531, 56532, 56541, 56542])
            await free(port);
        if (!process.env.PARKING_PG_BIN)
            throw new Error('Set PARKING_PG_BIN to your PostgreSQL bin directory');
        pgVersion = execFileSync(path.join(process.env.PARKING_PG_BIN, 'postgres.exe'), ['--version'], { encoding: 'utf8', windowsHide: true }).trim();
        native = await require('./native-postgres.cjs').startNative(process.env.PARKING_PG_BIN, pgPort, out);
        const dbs = {};
        for (const service of ['identity', 'parking', 'payment', 'ai']) {
            const config = await native.database(service);
            const client = new Client({ host: '127.0.0.1', port: pgPort, user: 'postgres', database: config.database });
            await client.connect();
            clients.push(client);
            dbs[service] = { connectionString: config.connectionString, exec: sql => client.query(sql), query: (sql, params) => client.query(sql, params) };
            await dbs[service].exec(fs.readFileSync(path.join(root, `database/services/${service}/001_schema.sql`), 'utf8'));
        }
        host('identity', 5041, 5042, dbs.identity.connectionString);
        await ready('http://127.0.0.1:5041/health/ready');
        const identity = 'http://127.0.0.1:5041';
        const customer = await call('Register synthetic Customer', identity + '/api/v1/auth/register', 'POST', { emailNormalized: 'customer@qa.example.test', phoneE164: '+84900000101', fullName: 'Synthetic QA Customer', password, roles: ['CUSTOMER'] });
        const ownerAuth = await call('Login Customer', identity + '/api/v1/auth/login', 'POST', { email: 'customer@qa.example.test', password });
        const staffAuth = await call('Login Staff', identity + '/api/v1/auth/login', 'POST', { email: 'staff@qa.example.test', password });
        const subject = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub;
        const owner = subject(ownerAuth.accessToken), staff = subject(staffAuth.accessToken);
        let fixture = fs.readFileSync(path.join(root, 'database/services/parking/002_demo_fixture.sql'), 'utf8').replaceAll(":'customer_id'::uuid", `'${owner}'::uuid`).replaceAll(":'admin_id'::uuid", `'${staff}'::uuid`);
        await dbs.parking.exec(fixture);
        await dbs.parking.exec(`INSERT INTO lot_gates(id,lot_id,code,gate_kind) VALUES('${gate}','${lot}','QA-ENTRY','ENTRY')`);
        await dbs.identity.exec(`INSERT INTO lot_staff_assignments(user_id,lot_id,role_code,valid_from) VALUES('${staff}','${lot}','PARKING_STAFF',now()-interval '1 day')`);
        host('parking', 56521, 56522, dbs.parking.connectionString);
        host('payment', 56531, 56532, dbs.payment.connectionString);
        host('ai', 56541, 56542, dbs.ai.connectionString);
        for (const port of [56521, 56531, 56541])
            await ready(`http://127.0.0.1:${port}/health/ready`);
        const gatewayExtra = { RateLimit__PermitLimit: '10000', Services__identityHttp: 'http://127.0.0.1:5041', Services__parkingHttp: 'http://127.0.0.1:56521', Services__paymentHttp: 'http://127.0.0.1:56531', Services__aiHttp: 'http://127.0.0.1:56541' };
        for (const [service, port] of [['identity', 5041], ['parking', 56521], ['payment', 56531], ['ai', 56541]])
            gatewayExtra[`ReverseProxy__Clusters__${service}__Destinations__main__Address`] = `http://127.0.0.1:${port}/`;
        host('gateway', 56500, 50501, 'unused', gatewayExtra);
        await ready('http://127.0.0.1:56500/health/ready');
        const base = 'http://127.0.0.1:56500';
        await call('Gateway ready', base + '/health/ready');
        await call('List actual lots', base + '/api/v1/parking-lots');
        const startsAt = new Date(Date.now() + 120000).toISOString(), endsAt = new Date(Date.now() + 3720000).toISOString();
        await call('Search actual price', base + '/api/v1/parking-lots/search?vehicleType=CAR&expectedDuration=60&sortBy=CHEAPEST&startTime=' + encodeURIComponent(startsAt));
        const booking = await call('Create booking', base + '/api/v1/bookings', 'POST', { lotId: lot, slotId: slot, vehicleId: vehicle, startsAt, endsAt }, ownerAuth.accessToken, 'qa-booking-' + Date.now());
        const payment = await call('Create actual CASH payment', base + '/api/v1/payments', 'POST', { bookingId: booking.id, method: 'CASH' }, ownerAuth.accessToken, 'qa-cash-' + Date.now());
        await call('Scoped Staff confirms CASH', base + `/api/v1/parking-lots/${lot}/payments/${payment.id}/cash-confirmation`, 'POST', { version: payment.version, reason: 'Synthetic local cash test' }, staffAuth.accessToken);
        let detail;
        for (let i = 0; i < 30; i++) {
            const r = await fetch(base + `/api/v1/bookings/${booking.id}`, { headers: { Authorization: 'Bearer ' + ownerAuth.accessToken } });
            const j = await r.json();
            detail = j.result;
            if (detail?.status === 'CONFIRMED')
                break;
            await sleep(500);
        }
        if (detail?.status !== 'CONFIRMED')
            throw new Error('Outbox delivery did not confirm booking');
        const ticket = await call('Issue actual QR', base + `/api/v1/bookings/${booking.id}/qr`, 'POST', {}, ownerAuth.accessToken);
        const checkin = { lotId: lot, gateId: gate, qrPayload: ticket.qrPayload, detectedPlate: '51A-123.45' };
        await call('Gateway check-in', base + '/api/v1/check-in', 'POST', checkin, staffAuth.accessToken, 'qa-gateway-checkin', null);
        const gatewayStatus = observations.at(-1).status;
        if (gatewayStatus !== 200 && gatewayStatus !== 404)
            throw new Error('Gateway check-in returned ' + gatewayStatus);
        if (gatewayStatus === 404)
            await call('Direct Parking check-in (bypasses Gateway)', 'http://127.0.0.1:56521/api/v1/check-in', 'POST', checkin, staffAuth.accessToken, 'qa-direct-checkin');
        const state = await dbs.parking.query("SELECT status::text, (SELECT count(*) FROM parking_sessions WHERE status='ACTIVE') active_sessions,(SELECT count(*) FROM session_slot_assignments WHERE vacated_at IS NULL) occupied_assignments FROM bookings WHERE id=$1", [booking.id]);
        if (state.rows[0]?.status !== 'CHECKED_IN' || Number(state.rows[0]?.active_sessions) !== 1 || Number(state.rows[0]?.occupied_assignments) !== 1)
            throw new Error('Expected exactly one committed admission');
        observations.push({ label: 'Database state after actual CASH and check-in', result: state.rows });
        console.log('PARTIAL_REAL_WORKFLOW_COMPLETE; no checkout or realtime acceptance. Evidence: ' + out + '');
    }
    catch (error) {
        observations.push({ label: 'STOPPED', message: error.message });
        console.error(error.message);
        process.exitCode = 1;
    }
    finally {
        for (const child of processes)
            child.kill();
        await sleep(500);
        for (const client of clients)
            await client.end().catch(() => { });
        if (native)
            await native.server.stop().catch(() => { });
        fs.writeFileSync(path.join(out, 'DEMO_API_EVIDENCE.json'), JSON.stringify({ commit, pgVersion, scope: 'Isolated native PostgreSQL; actual service APIs and actual CASH/outbox; no VNPay provider, no checkout, no physical barrier', observations }, null, 2));
    }
})();


