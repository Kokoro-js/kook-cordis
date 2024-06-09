import { Context, createLogger, Schema, Service } from 'kook-cordis';
import Napi from '@napi-rs/canvas';
import * as echartsNode from 'echarts';
import * as leaferNode from '@leafer-ui/node';
import { Rect } from '@leafer-ui/node';

export { echartsNode, leaferNode };

export const name = 'render';
const logger = createLogger(name);

declare module 'kook-cordis' {
  interface Context {
    render: Render;
  }

  interface Events {}
}

export class Render extends Service {
  canvas = Napi;
  echarts = echartsNode;
  leaferui = leaferNode;

  get presetFont() {
    return 'LXGW WenKai Lite';
  }

  constructor(
    ctx: Context,
    public config: Render.Config,
  ) {
    super(ctx, 'render');

    // 加载字体
    this.canvas.GlobalFonts.registerFromPath(__dirname + '/fonts');
    this.leaferui.useCanvas('napi', Napi);
    this.echarts.setPlatformAPI({
      createCanvas() {
        return Napi.createCanvas(32, 32) as any;
      },
      // https://github.com/apache/echarts/issues/19054
      // https://github.com/Brooooooklyn/canvas/issues/719
      loadImage(src, onload, onerror) {
        const img = new Napi.Image() as any;
        let source: any = src;
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
        return (
          '加载的字体：' + this.canvas.GlobalFonts.families.map((item) => item.family).join(', ')
        );
      });

    /*ctx.router('get', '/render/leafer', async (res, req) => {
      const leafer = new this.leaferui.Leafer({ width: 600, height: 800 });
      const background = new Rect({
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

      const cardDesign = new Rect({
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
    });*/
  }

  async createChart(
    width: number = this.config.width,
    height: number = this.config.height,
    options: echartsNode.EChartsOption,
    theme?: string,
  ) {
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

    let chart = this.echarts.init(_canvas as any, theme || this.config.defaultTheme);
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

  async createChartPNG(
    width: number = this.config.width,
    height: number = this.config.height,
    options: echartsNode.EChartsOption,
    theme?: string,
  ) {
    const chart = await this.createChart(width, height, options, theme);
    const buffer = chart.canvas.toBuffer('image/png');
    chart.dispose();
    return buffer;
  }
}

export default Render;

export namespace Render {
  export interface Config {
    path: string;
    defaultTheme: string;
    width: number;
    height: number;
  }

  export const Config: Schema<Config> = Schema.object({
    path: Schema.string().description('napi 的二进制文件目录').default('binary'),
    defaultTheme: Schema.string().description('Echarts 默认主题').default('light'),
    width: Schema.natural().description('Table default width').default(1000),
    height: Schema.natural().description('Table default height').default(700),
  });
}
