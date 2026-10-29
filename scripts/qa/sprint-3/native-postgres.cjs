// QA-only native PostgreSQL cluster. Never connects to a shared database.
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

function run(executable, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(executable, args, { windowsHide: true, env: { ...process.env, PGCLIENTENCODING: 'UTF8' } });
        let stdout = '', stderr = '';
        child.stdout.on('data', bytes => stdout += bytes);
        child.stderr.on('data', bytes => stderr += bytes);
        child.on('error', reject);
        child.on('exit', code => code === 0 ? resolve(stdout) : reject(new Error(stderr)));
    });
}

async function startNative(bin, port, output) {
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid isolated PostgreSQL port');
    const cluster = fs.mkdtempSync(path.join(output, 'cluster-'));
    await run(path.join(bin, 'initdb.exe'), ['-D', cluster, '-A', 'trust', '-U', 'postgres', '--encoding=UTF8', '--no-locale']);
    await run(path.join(bin, 'pg_ctl.exe'), ['start', '-D', cluster, '-l', path.join(output, 'postgres.log'), '-o', `-p ${port} -h 127.0.0.1`, '-w']);
    return {
        server: { stop: () => run(path.join(bin, 'pg_ctl.exe'), ['stop', '-D', cluster, '-m', 'fast', '-w']) },
        database: async service => {
            if (!['identity', 'parking', 'payment', 'ai'].includes(service)) throw new Error('Unexpected QA database owner');
            const database = 'parking_qa_' + service;
            await run(path.join(bin, 'createdb.exe'), ['-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', database]);
            return { database, connectionString: `Host=127.0.0.1;Port=${port};Username=postgres;Database=${database};SSL Mode=Disable;Timeout=5;Command Timeout=15` };
        }
    };
}

module.exports = { startNative };
