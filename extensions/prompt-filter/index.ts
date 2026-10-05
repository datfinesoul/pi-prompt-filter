import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadPatterns, matchesAnyPattern } from "../../src/patterns.js";

const extensionDirectory = dirname(fileURLToPath(import.meta.url));
const defaultConfigPath = join(extensionDirectory, "config.json");
const userConfigPath = join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "pi", "prompt-filter.json");

export default function promptFilter(pi: ExtensionAPI) {
  const patterns = loadPatterns(defaultConfigPath, existsSync(userConfigPath) ? userConfigPath : undefined);

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
