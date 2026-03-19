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

/**
 * Copy static assets to build folder to make it a complete extension package.
 */
async function copyStaticAssets() {
    // Ensure build directory exists
    await fs.promises.mkdir("build", { recursive: true });

    // Read and transform manifest.json
    const manifest = JSON.parse(await fs.promises.readFile("manifest.json", "utf8"));

    // Update content_scripts paths: remove "build/" prefix since we're now in build/
    if (manifest.content_scripts) {
        for (const script of manifest.content_scripts) {
            if (script.js) {
                script.js = script.js.map(p => p.replace(/^build\//, ""));
            }
            if (script.css) {
                script.css = script.css.map(p => p.replace(/^build\//, ""));
            }
        }
    }

    // Write transformed manifest to build/
    await fs.promises.writeFile(
        "build/manifest.json",
        JSON.stringify(manifest, null, 2)
    );
    console.log("Copied: build/manifest.json");

    // Copy icons directory
    const iconsDir = "icons";
    const buildIconsDir = "build/icons";

    if (fs.existsSync(iconsDir)) {
        await fs.promises.mkdir(buildIconsDir, { recursive: true });
        const icons = await fs.promises.readdir(iconsDir);
        for (const icon of icons) {
            await fs.promises.copyFile(
                path.join(iconsDir, icon),
                path.join(buildIconsDir, icon)
            );
        }
        console.log(`Copied: build/icons/ (${icons.length} files)`);
    }
}

const buildOptions = {
    entryPoints: ["src/content/index.js"],
    bundle: true,
    outfile: "build/content.js",
    format: "iife",
    target: ["chrome126", "firefox128"],
    minify: false,
    sourcemap: false,
    plugins: [inlineCssPlugin],
    logLevel: "info"
};

if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await copyStaticAssets();
    await ctx.watch();
    console.log("Watching for changes...");
} else {
    await esbuild.build(buildOptions);
    await copyStaticAssets();
    console.log("Build complete: build/");
}
