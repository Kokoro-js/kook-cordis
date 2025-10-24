import { Context } from "@pluxel/hmr";
import { PinoLoggerService } from "@pluxel/hmr/services";

const ctx = new Context({
	hmrService: { dir: ["./src/plugins", "."] },
	graphql: {
		destination: "./gqty/index.ts",
	},
	registry: {
		plugigCTXIsolate: [PinoLoggerService],
	},
});

await ctx.hmrService.start();
setTimeout(() => console.log(ctx.loader.ctorMap), 1000);
ctx.honoService.modifyApp((app) => {
	app.get("/pluginadd", (c) => {
		return c.text("lastone");
	});
});
