"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vm2_1 = require("vm2");
const net_1 = __importDefault(require("net"));
const crypto_1 = __importDefault(require("crypto"));
const evaluate = (script, scope) => {
    const vm = new vm2_1.VM({
        allowAsync: true,
        sandbox: scope
    });
    return vm.run(script, scope);
};
const socketName = crypto_1.default.randomBytes(20).toString('hex');
const server = net_1.default.createServer((socket) => {
    const buffer = [];
    const sync = () => {
        const request = buffer.join('').toString();
        if (request.includes('\n')) {
            try {
                const { code, scope } = JSON.parse(request);
                const result = evaluate(code, Object.assign(Object.assign({}, scope), { module: {} }));
                socket.write(JSON.stringify({ result }) + '\n');
                socket.end();
            }
            catch (error) {
                socket.write(JSON.stringify({ error: error.message }) + '\n');
                socket.end();
            }
        }
    };
    socket.on('data', data => {
        buffer.push(data);
        sync();
    });
});
server.on('listening', () => {
    console.log(`/tmp/vm2-${socketName}.sock`);
});
server.listen(`/tmp/vm2-${socketName}.sock`);
