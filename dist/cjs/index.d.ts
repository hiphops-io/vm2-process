export default createVm2Pool;
declare function createVm2Pool({ min, max, ...limits }: {
    [x: string]: any;
    min: any;
    max: any;
}): {
    run: (code: any, scope: any) => Promise<any>;
    drain: () => void;
};
