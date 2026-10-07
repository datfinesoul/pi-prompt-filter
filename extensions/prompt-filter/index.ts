import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { resolveConfigPaths } from "../../src/config-paths.js";
import { loadPatterns, matchesAnyPattern } from "../../src/patterns.js";

const extensionDirectory = dirname(fileURLToPath(import.meta.url));
const defaultConfigPath = join(extensionDirectory, "config.json");

export default function promptFilter(pi: ExtensionAPI) {
  // Bundled rules must always be valid; failing here reports a packaging error.
  const bundledPatterns = loadPatterns(defaultConfigPath);
  let patterns = bundledPatterns;

  function loadLayeredPatterns(ctx: ExtensionContext) {
    const paths = resolveConfigPaths({
      agentDir: getAgentDir(),
      cwd: ctx.cwd,
      // Project rules change how prompts are handled, so honor Pi's project trust.
      projectTrusted: ctx.isProjectTrusted(),
    });

    try {
      patterns = loadPatterns(defaultConfigPath, paths.global, paths.project);
    } catch (error) {
      patterns = bundledPatterns;
      ctx.ui.notify(
        `prompt-filter: ${error instanceof Error ? error.message : String(error)}. Using bundled rules only.`,
        "error",
      );
    }
  }

  pi.on("session_start", (_event, ctx) => {
    loadLayeredPatterns(ctx);
  });

  pi.on("input", async (event, ctx) => {
    if (event.source !== "interactive") {
      return { action: "continue" };
    }

    if (matchesAnyPattern(event.text, patterns)) {
      ctx.ui.notify(`Ignored prompt matching a prompt-filter rule: ${event.text}`, "warning");
      return { action: "handled" };
    }

    return { action: "continue" };
  });
}
