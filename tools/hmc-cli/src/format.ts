import pc from "picocolors";
import type { Feature } from "./catalog.js";
import { tierName } from "./catalog.js";

/**
 * Returns a color function appropriate for the given tier.
 * Tier 1 = blue, Tier 2 = green, Tier 3 = yellow, Tier 4 = red.
 */
export function tierColor(tier: number): (text: string) => string {
  switch (tier) {
    case 1:
      return pc.blue;
    case 2:
      return pc.green;
    case 3:
      return pc.yellow;
    case 4:
      return pc.red;
    default:
      return pc.white;
  }
}

/**
 * Returns a status icon for the given feature status.
 */
export function statusIcon(status: string): string {
  switch (status) {
    case "extracted":
      return pc.green("✓");
    case "planned":
      return pc.yellow("○");
    case "domain":
      return pc.cyan("◇");
    default:
      return " ";
  }
}

/**
 * Returns a colored badge for the given complexity level.
 */
export function complexityBadge(complexity: string): string {
  switch (complexity) {
    case "S":
      return pc.green("[S]");
    case "M":
      return pc.blue("[M]");
    case "L":
      return pc.yellow("[L]");
    case "XL":
      return pc.red("[XL]");
    default:
      return `[${complexity}]`;
  }
}

/**
 * Formats a feature as a single-line row for the list display.
 * Format: [status] ID  Name  (package)  [complexity]
 */
export function formatFeatureRow(f: Feature): string {
  const color = tierColor(f.tier);
  const icon = statusIcon(f.status);
  const badge = complexityBadge(f.complexity);
  const pkg = f.package ? pc.dim(` (${f.package})`) : "";
  const id = pc.dim(f.id);

  return `  ${icon} ${id}  ${color(f.displayName)}${pkg}  ${badge}`;
}

/**
 * Formats a feature's full detail view for the info command.
 */
export function formatFeatureDetail(f: Feature): string {
  const color = tierColor(f.tier);
  const divider = pc.dim("─".repeat(60));
  const lines: string[] = [];

  lines.push(divider);
  lines.push(`  ${color(pc.bold(f.displayName))}  ${statusIcon(f.status)} ${pc.dim(f.status)}`);
  lines.push(divider);
  lines.push("");
  lines.push(`  ${pc.bold("ID:")}          ${f.id}`);
  lines.push(`  ${pc.bold("Name:")}        ${f.name}`);
  lines.push(`  ${pc.bold("Tier:")}        ${color(`${f.tier} - ${tierName(f.tier)}`)}`);
  lines.push(`  ${pc.bold("Complexity:")}  ${complexityBadge(f.complexity)}`);
  lines.push(`  ${pc.bold("Category:")}    ${f.category}`);

  if (f.package) {
    lines.push(`  ${pc.bold("Package:")}     ${pc.cyan(f.package)}`);
  }

  lines.push("");
  lines.push(`  ${pc.bold("Description:")}`);
  lines.push(`  ${pc.dim(f.description)}`);

  lines.push("");
  lines.push(`  ${pc.bold("Best Source:")}  ${f.bestSource}`);

  if (f.alsoIn.length > 0) {
    lines.push(`  ${pc.bold("Also In:")}     ${f.alsoIn.join(", ")}`);
  }

  if (f.dependencies.length > 0) {
    lines.push(`  ${pc.bold("Dependencies:")} ${f.dependencies.join(", ")}`);
  }

  if (f.configRequired.length > 0) {
    lines.push("");
    lines.push(`  ${pc.bold("Config Required:")}`);
    for (const cfg of f.configRequired) {
      lines.push(`    ${pc.yellow("•")} ${cfg}`);
    }
  }

  if (f.tags.length > 0) {
    lines.push("");
    lines.push(`  ${pc.bold("Tags:")} ${f.tags.map((t) => pc.dim(`#${t}`)).join(" ")}`);
  }

  lines.push("");
  lines.push(divider);

  return lines.join("\n");
}
