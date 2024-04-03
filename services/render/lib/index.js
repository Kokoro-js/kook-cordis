"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Render = exports.name = exports.leaferNode = exports.echartsNode = void 0;
const kook_cordis_1 = require("kook-cordis");
const canvas_1 = __importDefault(require("@napi-rs/canvas"));
const echartsNode = __importStar(require("echarts"));
exports.echartsNode = echartsNode;
const leaferNode = __importStar(require("@leafer-ui/node"));
exports.leaferNode = leaferNode;
const node_1 = require("@leafer-ui/node");
exports.name = 'render';
const logger = (0, kook_cordis_1.createLogger)(exports.name);
class Render extends kook_cordis_1.Service {
    config;
    canvas = canvas_1.default;
    echarts = echartsNode;
    leaferui = leaferNode;
    get presetFont() {
        return 'LXGW WenKai Lite';
    }
    constructor(ctx, config) {
        super(ctx, 'render');
        this.config = config;
        // 加载字体
        this.canvas.GlobalFonts.registerFromPath(__dirname + '/fonts');
        this.leaferui.useCanvas('napi', canvas_1.default);
        this.echarts.setPlatformAPI({
            createCanvas() {
                return canvas_1.default.createCanvas(32, 32);
            },
            // https://github.com/apache/echarts/issues/19054
            // https://github.com/Brooooooklyn/canvas/issues/719
            loadImage(src, onload, onerror) {
                const img = new canvas_1.default.Image();
                let source = src;
                if (typeof source == 'string') {
                    const commaIdx = source.indexOf(',');
                    const encoding = source.lastIndexOf('base64', commaIdx) < 0 ? 'utf-8' : 'base64';
                    source = Buffer.from(source.slice(commaIdx + 1), encoding);
                }
                img.src = source;
                return img;
            },
        });
        ctx
            .command('canvas', '查看已加载字体', {})
            .developerOnly()
            .action(() => {
            return ('加载的字体：' + this.canvas.GlobalFonts.families.map((item) => item.family).join(', '));
        });
        ctx.router('get', '/render/leafer', async (res, req) => {
            const leafer = new this.leaferui.Leafer({ width: 600, height: 800 });
            const background = new node_1.Rect({
                width: 600, // 设定宽度为 600
                height: 800, // 设定高度为 800
                fill: {
                    type: 'linear',
                    from: { x: 0, y: 0 }, // 从左边中间开始
                    to: { x: 1, y: 1 }, // 到右边中间结束
                    stops: [
                        { offset: 0, color: '#d2dff3' }, // 淡绿色
                        { offset: 0.5, color: '#e5edc1' }, // 浅绿色
                        { offset: 1, color: '#FFD3B6' }, // 淡橙色
                    ],
                },
            });
            const cardDesign = new node_1.Rect({
                cornerRadius: 15,
                opacity: 0.6,
                fill: {
                    type: 'solid',
                    color: 'rgba(0,0,0)', // 暗蓝色背景
                },
            });
            const card1 = cardDesign.clone();
            card1.set({ x: 100, y: 25, width: 400, height: 125 });
            leafer.add(background);
            leafer.add(card1);
            leafer
                .export('png', { blob: true })
                .then((result) => {
                // 使用 cork 方法来进行写入
                res.cork(() => {
                    res.end(result.data);
                });
            })
                .catch((error) => {
                // 错误处理也应该在 cork 方法中完成
                res.cork(() => {
                    res.end('An error occurred');
                });
            });
            // 添加中断处理器
            res.onAborted(() => {
                logger.error('请求被中断');
            });
        });
    }
    async createChart(width = this.config.width, height = this.config.height, options, theme) {
        let _canvas = this.canvas.createCanvas(width, height);
        const defaultTextStyle = {
            fontFamily: this.presetFont, // 字体系列
            fontSize: 18, // 字体大小
        };
        if (!options.textStyle) {
            options.textStyle = defaultTextStyle;
        }
        if (!options.animation) {
            options.animation = false;
        }
        let chart = this.echarts.init(_canvas, theme || this.config.defaultTheme);
        chart.setOption(options);
        const disposeChart = () => {
            chart.dispose();
            chart = null;
            _canvas = null;
        };
        return {
            canvas: _canvas,
            chart: chart,
            dispose: disposeChart,
        };
    }
    async createChartPNG(width = this.config.width, height = this.config.height, options, theme) {
        const chart = await this.createChart(width, height, options, theme);
        const buffer = chart.canvas.toBuffer('image/png');
        chart.dispose();
        return buffer;
    }
}
exports.Render = Render;
exports.default = Render;
(function (Render) {
    Render.Config = kook_cordis_1.Schema.object({
        path: kook_cordis_1.Schema.string().description('napi 的二进制文件目录').default('binary'),
        defaultTheme: kook_cordis_1.Schema.string().description('Echarts 默认主题').default('light'),
        width: kook_cordis_1.Schema.natural().description('Table default width').default(1000),
        height: kook_cordis_1.Schema.natural().description('Table default height').default(700),
    });
})(Render || (exports.Render = Render = {}));
