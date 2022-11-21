"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const waitUntil = (condition) => {
    if (condition()) {
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        const interval = setInterval(() => {
            if (!condition()) {
                return;
            }
            clearInterval(interval);
            resolve();
        }, 0);
    });
};
exports.default = waitUntil;
