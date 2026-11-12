const path = require('node:path');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');

function docker(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, { windowsHide: true });
    let output = '';
    let errors = '';
    child.stdout.on('data', chunk => output += chunk);
    child.stderr.on('data', chunk => errors += chunk);
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve(output.trim()) : reject(new Error(errors)));
  });
}

async function waitForContainer(args) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try { await docker(args); return; }
    catch { await new Promise(resolve => setTimeout(resolve, 500)); }
  }
  throw new Error('Test container failed readiness.');
}

(async () => {
  let native;
  const containers = [];
  const dockerMode = process.argv.includes('--docker');
  const testArgs = process.argv.slice(2).filter(arg => arg !== '--docker');
  try {
    if (dockerMode) {
      const suffix = randomUUID().slice(0, 8);
      containers.push(await docker(['run', '-d', '--rm', '--name', `parking-sprint4-pg-${suffix}`,
        '-p', '127.0.0.1:50472:5432', '--tmpfs', '/var/lib/postgresql/data',
        '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17-alpine']));
      containers.push(await docker(['run', '-d', '--rm', '--name', `parking-sprint4-redis-${suffix}`,
        '-p', '127.0.0.1:50473:6379', 'redis:7-alpine', 'redis-server', '--save', '', '--appendonly', 'no']));
      await waitForContainer(['exec', containers[0], 'pg_isready', '-U', 'postgres']);
      await waitForContainer(['exec', containers[1], 'redis-cli', 'ping']);
      console.log('Isolated PostgreSQL 17 and Redis ready.');
    } else {
      native = await require('../../scripts/microservices/native_test_database.cjs')
        .startNative(process.env.PARKING_PG_BIN ?? 'D:/Apps/PostgreSQL18/bin');
      console.log('Isolated native PostgreSQL ready.');
    }
    const env = {
      ...process.env,
      PARKING_TEST_ADMIN_CONNECTION: `Host=127.0.0.1;Port=${dockerMode ? 50472 : 50471};Username=postgres;Database=postgres;SSL Mode=Disable`,
      PARKING_TEST_REDIS_CONNECTION: dockerMode ? '127.0.0.1:50473,abortConnect=false' : '',
      PARKING_REPO_ROOT: process.cwd(),
      PARKING_TEST_API_DLL: path.resolve('src/Services/Parking/Parking.Parking.Api/bin/Debug/net9.0/Parking.Parking.Api.dll'),
      PARKING_TEST_IDENTITY_DLL: path.resolve('src/Services/Identity/Parking.Identity.Api/bin/Debug/net9.0/Parking.Identity.Api.dll'),
      PARKING_TEST_PAYMENT_DLL: path.resolve('src/Services/Payment/Parking.Payment.Api/bin/Debug/net9.0/Parking.Payment.Api.dll')
    };
    process.exitCode = await new Promise((resolve, reject) => {
      const child = spawn('dotnet', [
        'test', 'tests/Parking.Microservices.Tests/Parking.Microservices.Tests.csproj',
        '--no-build', '--no-restore', '--logger',
        `trx;LogFileName=six-tickets-${dockerMode ? 'postgres17' : 'native'}${testArgs.length ? '-focused' : ''}.trx`,
        '--results-directory', 'artifacts/six-tickets', '--verbosity', 'minimal',
        ...testArgs
      ], { env, stdio: 'inherit', windowsHide: true });
      child.on('error', reject);
      child.on('exit', resolve);
    });
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    if (native) {
      await native.server.stop();
      console.log('Isolated PostgreSQL stopped.');
    }
    for (const container of containers.reverse()) await docker(['rm', '--force', container]);
    if (containers.length) console.log('Test containers removed.');
  }
})();
