import * as esbuild from "esbuild";
import * as fs from "fs";
import * as path from "path";

const isWatch = process.argv.includes("--watch");
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

// ─────────────────────────────────────────────────────────────
// Console Output Formatting
// ─────────────────────────────────────────────────────────────

const c = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    magenta: "\x1b[35m",
    blue: "\x1b[34m",
};

const LINE = "━".repeat(40);

function formatSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatTime(ms) {
    return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`;
}

function log(icon, label, value = "", extra = "") {
    const paddedLabel = label.padEnd(10);
    const coloredValue = value ? `${c.bold}${value}${c.reset}` : "";
    const dimExtra = extra ? `${c.dim}${extra}${c.reset}` : "";
    console.log(`${icon} ${c.cyan}${paddedLabel}${c.reset}${coloredValue} ${dimExtra}`);
}

function header() {
    console.log(`\n${c.dim}${LINE}${c.reset}`);
    console.log(`🚀 ${c.bold}42 Friends FR${c.reset} ${c.dim}— Build started${c.reset}`);
    log("🏷️ ", "Version", pkg.version);
    console.log(`${c.dim}${LINE}${c.reset}`);
}

function success(duration) {
    console.log(`${c.dim}${LINE}${c.reset}`);
    log("✅", "Success", "Build complete", `in ${formatTime(duration)}`);
    log("📁", "Output", "build/");
    console.log(`${c.dim}${LINE}${c.reset}\n`);
}

function watchMode() {
    console.log(`${c.dim}${LINE}${c.reset}`);
    log("👀", "Watching", "for changes...");
    console.log(`${c.dim}${LINE}${c.reset}\n`);
}

function error(err) {
    console.log(`${c.dim}${LINE}${c.reset}`);
    console.log(`❌ ${c.red}${c.bold}Build failed${c.reset}`);
    console.log(`${c.dim}${err.message || err}${c.reset}`);
    console.log(`${c.dim}${LINE}${c.reset}\n`);
}

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

    // Read manifest.json
    const manifest = JSON.parse(await fs.promises.readFile("manifest.json", "utf8"));

    // Sync version from package.json (single source of truth)
    const versionChanged = manifest.version !== pkg.version;
    manifest.version = pkg.version;

    // Write synced version back to root manifest.json
    if (versionChanged) {
        await fs.promises.writeFile(
            "manifest.json",
            JSON.stringify(manifest, null, 2) + "\n"
        );
        log("🔄", "Synced", "manifest.json", `→ v${pkg.version}`);
    }

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
    log("📄", "Copied", "manifest.json");

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
        log("🖼️ ", "Copied", "icons/", `${icons.length} files`);
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
    logLevel: "silent",
    metafile: true,
};

// ─────────────────────────────────────────────────────────────
// Build Execution
// ─────────────────────────────────────────────────────────────

const startTime = Date.now();

try {
    header();

    if (isWatch) {
        const ctx = await esbuild.context(buildOptions);
        const result = await ctx.rebuild();
        const outSize = fs.statSync("build/content.js").size;
        log("📦", "Bundled", "content.js", formatSize(outSize));
        await copyStaticAssets();
        await ctx.watch();
        watchMode();
    } else {
        await esbuild.build(buildOptions);
        const outSize = fs.statSync("build/content.js").size;
        log("📦", "Bundled", "content.js", formatSize(outSize));
        await copyStaticAssets();
        success(Date.now() - startTime);
    }
} catch (err) {
    error(err);
    process.exit(1);
}
