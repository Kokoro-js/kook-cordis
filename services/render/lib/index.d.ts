/// <reference types="node" />
import { Context, Schema, Service } from 'kook-cordis';
import Napi from '@napi-rs/canvas';
import * as echartsNode from 'echarts';
import * as leaferNode from '@leafer-ui/node';
export { echartsNode, leaferNode };
export declare const name = "render";
declare module 'kook-cordis' {
    interface Context {
        render: Render;
    }
    interface Events {
    }
}
export declare class Render extends Service {
    config: Render.Config;
    canvas: typeof Napi;
    echarts: typeof echartsNode;
    leaferui: typeof leaferNode;
    get presetFont(): string;
    constructor(ctx: Context, config: Render.Config);
    createChart(width: number, height: number, options: echartsNode.EChartsOption, theme?: string): Promise<{
        canvas: Napi.Canvas;
        chart: echartsNode.ECharts;
        dispose: () => void;
    }>;
    createChartPNG(width: number, height: number, options: echartsNode.EChartsOption, theme?: string): Promise<Buffer>;
}
export default Render;
export declare namespace Render {
    interface Config {
        path: string;
        defaultTheme: string;
        width: number;
        height: number;
    }
    const Config: Schema<Config>;
}
