"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const net_1 = __importDefault(require("net"));
const crypto_1 = __importDefault(require("crypto"));
const generic_pool_1 = __importDefault(require("generic-pool"));
const final_stream_1 = __importDefault(require("final-stream"));
const waitUntil_js_1 = __importDefault(require("./waitUntil.js"));
const createVm2Pool = (_a) => {
    var { min, max } = _a, limits = __rest(_a, ["min", "max"]);
    limits = Object.assign({
        cpu: 100,
        memory: 2000,
        time: 4000
    }, limits);
    let limitError = null;
    const ref = crypto_1.default.randomBytes(20).toString('hex');
    const kill = () => {
        (0, child_process_1.spawn)('sh', ['-c', `pkill -9 -f ${ref}`]);
    };
    let stderrCache = '';
    const factory = {
        create: function () {
            const runner = (0, child_process_1.spawn)('cpulimit', [
                '-ql', limits.cpu,
                '--',
                'node', `--max-old-space-size=${limits.memory}`, 'vm2ProcessRunner.js', ref
            ], { cwd: __dirname, shell: false });
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
    const pool = generic_pool_1.default.createPool(factory, { min, max });
    const run = async (code, scope) => {
        const childProcess = await pool.acquire();
        await (0, waitUntil_js_1.default)(() => childProcess.socket);
        const socket = net_1.default.createConnection(childProcess.socket);
        const timer = setTimeout(() => {
            limitError = 'code execution took too long and was killed';
            kill(childProcess);
        }, limits.time);
        socket.write(JSON.stringify({ code, scope }) + '\n');
        try {
            const data = await (0, final_stream_1.default)(socket).then(JSON.parse);
            if (data.error) {
                throw new Error(data.error);
            }
            return data.result;
        }
        catch (error) {
            throw new Error(limitError || error);
        }
        finally {
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
exports.default = createVm2Pool;
