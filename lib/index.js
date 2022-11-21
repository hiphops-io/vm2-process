import { spawn } from 'child_process';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import net from 'net';
import crypto from 'crypto';
import genericPool from 'generic-pool';
import finalStream from 'final-stream';
import waitUntil from './waitUntil.js';

const createVm2Pool = ({ min, max, ...limits }) => {
  const __dirName = dirname(fileURLToPath(import.meta.url));

  limits = Object.assign({
    cpu: 100,
    memory: 2000,
    time: 4000
  }, limits);

  let limitError = null;

  const ref = crypto.randomBytes(20).toString('hex');

  const kill = () => {
    spawn('sh', ['-c', `pkill -9 -f ${ref}`]);
  };

  let stderrCache = '';
  const factory = {
    create: function () {
      const runner = spawn('cpulimit', [
        '-ql', limits.cpu,
        '--',
        'node', `--max-old-space-size=${limits.memory}`, 'vm2ProcessRunner.js', ref
      ], { cwd: __dirName, shell: false });

      runner.stdout.on('data', (data) => {
        runner.socket = runner.socket || data.toString().trim();
      });

      runner.stderr.on('data', (data) => {
        stderrCache = stderrCache + data.toString();
        if (stderrCache.includes('FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory')) {
          limitError = 'code execution exceeed allowed memory';
        }
      });

      return runner;
    },

    destroy: function (childProcess) {
      kill(childProcess);
    }
  };

  const pool = genericPool.createPool(factory, { min, max });

  const run = async (code, scope) => {
    const childProcess = await pool.acquire();

    await waitUntil(() => childProcess.socket);

    const socket = net.createConnection(childProcess.socket);

    const timer = setTimeout(() => {
      limitError = 'code execution took too long and was killed';
      kill(childProcess);
    }, limits.time);

    socket.write(JSON.stringify({ code, scope }) + '\n');

    try {
      const data = await finalStream(socket).then(JSON.parse);

      if (data.error) {
        throw new Error(data.error);
      }

      return data.result;
    } catch (error) {
      throw new Error(limitError || error);
    } finally {
      clearTimeout(timer);
      pool.destroy(childProcess);
    }
  };

  return {
    run,
    drain: () => {
      pool.drain().then(() => pool.clear());
    }
  };
};

export default createVm2Pool;
