import * as esbuild from "esbuild";
import * as fs from "fs";
import * as path from "path";

const isWatch = process.argv.includes("--watch");

/**
 * Custom plugin to inline CSS as a string export.
 * This allows us to import CSS and inject it at runtime.
 */
const inlineCssPlugin = {
    name: "inline-css",
    setup(build) {
        build.onLoad({ filter: /\.css$/ }, async (args) => {
            const css = await fs.promises.readFile(args.path, "utf8");
            // Minify CSS: remove comments, collapse whitespace
            const minified = css
                .replace(/\/\*[\s\S]*?\*\//g, "")
                .replace(/\s+/g, " ")
                .replace(/\s*([{}:;,>+~])\s*/g, "$1")
                .trim();
            return {
                contents: `export default ${JSON.stringify(minified)};`,
                loader: "js"
            };
        });
    }
};

const buildOptions = {
    entryPoints: ["src/content/index.js"],
    bundle: true,
    outfile: "dist/content.js",
    format: "iife",
    target: ["chrome126", "firefox128"],
    minify: false,
    sourcemap: false,
    plugins: [inlineCssPlugin],
    logLevel: "info"
};

if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log("Watching for changes...");
} else {
    await esbuild.build(buildOptions);
    console.log("Build complete: dist/content.js");
}
