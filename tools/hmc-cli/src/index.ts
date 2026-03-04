#!/usr/bin/env node

import * as p from "@clack/prompts";
import pc from "picocolors";
import { writeFileSync } from "fs";
import { resolve } from "path";
import {
  loadCatalog,
  searchFeatures,
  resolveDependencies,
  groupByTier,
  getFeatureById,
  tierName,
  type Feature,
} from "./catalog.js";
import {
  formatFeatureRow,
  formatFeatureDetail,
  tierColor,
  statusIcon,
} from "./format.js";

const args = process.argv.slice(2);
const command = args[0];

function printUsage(): void {
  console.log(`
${pc.bold("hmc")} - HMC App Platform CLI

${pc.bold("Usage:")}
  hmc list                 List all features from catalog, grouped by tier
  hmc info <feature-id>    Show detailed info about a feature
  hmc create               Interactive app creation wizard
  hmc search <query>       Search features by name, description, or tags
  hmc help                 Show this help message

${pc.bold("Examples:")}
  hmc list
  hmc info F-001
  hmc create
  hmc search authentication
`);
}

function listCommand(): void {
  const features = loadCatalog();
  const groups = groupByTier(features);

  console.log("");
  console.log(pc.bold("  HMC Feature Catalog"));
  console.log(pc.dim("  " + "─".repeat(58)));
  console.log("");
  console.log(
    `  ${pc.green("✓")} extracted   ${pc.yellow("○")} planned   ${pc.cyan("◇")} domain`
  );
  console.log("");

  const sortedTiers = Array.from(groups.keys()).sort((a, b) => a - b);

  for (const tier of sortedTiers) {
    const tierFeatures = groups.get(tier)!;
    const color = tierColor(tier);
    console.log(color(pc.bold(`  ── Tier ${tier}: ${tierName(tier)} ──`)));
    console.log("");

    for (const f of tierFeatures) {
      console.log(formatFeatureRow(f));
    }
    console.log("");
  }

  console.log(
    pc.dim(`  ${features.length} features total`)
  );
  console.log("");
}

function infoCommand(featureId: string): void {
  const features = loadCatalog();
  const feature = getFeatureById(featureId, features);

  if (!feature) {
    console.error(pc.red(`  Error: Feature "${featureId}" not found.`));
    console.log(pc.dim(`  Try "hmc list" to see all features, or "hmc search <query>" to search.`));
    process.exit(1);
  }

  console.log(formatFeatureDetail(feature));
}

function searchCommand(query: string): void {
  const features = loadCatalog();
  const results = searchFeatures(query, features);

  if (results.length === 0) {
    console.log("");
    console.log(pc.yellow(`  No features found matching "${query}".`));
    console.log(pc.dim("  Try a different search term or use 'hmc list' to browse all features."));
    console.log("");
    return;
  }

  console.log("");
  console.log(pc.bold(`  Search results for "${query}" (${results.length} match${results.length === 1 ? "" : "es"}):`));
  console.log("");

  for (const f of results) {
    console.log(formatFeatureRow(f));
  }
  console.log("");
}

async function createCommand(): Promise<void> {
  const features = loadCatalog();

  p.intro(pc.bgCyan(pc.black(" HMC App Creator ")));

  // Step 1: App name
  const appName = await p.text({
    message: "What is the name of your app?",
    placeholder: "my-hmc-app",
    validate(value) {
      if (!value || value.trim().length === 0) return "App name is required.";
      if (!/^[a-z0-9-]+$/.test(value))
        return "App name must be lowercase letters, numbers, and hyphens only.";
      return undefined;
    },
  });

  if (p.isCancel(appName)) {
    p.cancel("App creation cancelled.");
    process.exit(0);
  }

  // Step 2: Description
  const description = await p.text({
    message: "Describe your app briefly:",
    placeholder: "A brief description of what the app does",
    validate(value) {
      if (!value || value.trim().length === 0) return "Description is required.";
      return undefined;
    },
  });

  if (p.isCancel(description)) {
    p.cancel("App creation cancelled.");
    process.exit(0);
  }

  // Step 3: Select tiers to show
  const tierOptions = [
    { value: 1 as number, label: "Tier 1: Foundation", hint: "Auth, DB, Security, UI" },
    { value: 2 as number, label: "Tier 2: Shared Features", hint: "LLM, Notifications, Audit" },
    { value: 3 as number, label: "Tier 3: Domain Features", hint: "Industry-specific features" },
    { value: 4 as number, label: "Tier 4: Enterprise & Compliance", hint: "DLP, Governance, SIEM" },
  ];

  const selectedTiers = await p.multiselect({
    message: "Which feature tiers do you want to browse?",
    options: tierOptions,
    required: true,
  });

  if (p.isCancel(selectedTiers)) {
    p.cancel("App creation cancelled.");
    process.exit(0);
  }

  // Step 4: Select features from chosen tiers
  const availableFeatures = features.filter((f) =>
    (selectedTiers as number[]).includes(f.tier)
  );

  const featureOptions = availableFeatures.map((f) => ({
    value: f.id,
    label: `${statusIcon(f.status)} ${f.displayName}`,
    hint: `${f.id} | ${f.complexity} | ${f.package || "planned"}`,
  }));

  // Pre-select all Foundation tier features (tier 1) if tier 1 is in selectedTiers
  const initialValues = (selectedTiers as number[]).includes(1)
    ? availableFeatures.filter((f) => f.tier === 1).map((f) => f.id)
    : [];

  const selectedFeatureIds = await p.multiselect({
    message: "Select features for your app:",
    options: featureOptions,
    initialValues,
    required: true,
  });

  if (p.isCancel(selectedFeatureIds)) {
    p.cancel("App creation cancelled.");
    process.exit(0);
  }

  // Step 5: Resolve dependencies
  const allIds = resolveDependencies(selectedFeatureIds as string[], features);
  const addedDeps = allIds.filter(
    (id) => !(selectedFeatureIds as string[]).includes(id)
  );

  if (addedDeps.length > 0) {
    p.note(
      addedDeps
        .map((id) => {
          const f = getFeatureById(id, features);
          return f ? `  ${f.id} - ${f.displayName}` : `  ${id}`;
        })
        .join("\n"),
      "Auto-added dependencies"
    );
  }

  // Step 6: Collect config for features that require it
  const configValues: Record<string, Record<string, string>> = {};
  const featuresNeedingConfig = allIds
    .map((id) => getFeatureById(id, features))
    .filter((f): f is Feature => f !== undefined && f.configRequired.length > 0);

  if (featuresNeedingConfig.length > 0) {
    p.note(
      "Some selected features require configuration values.\nYou can fill these in now or leave them empty to set later.",
      "Configuration"
    );

    for (const f of featuresNeedingConfig) {
      configValues[f.id] = {};
      for (const configItem of f.configRequired) {
        const value = await p.text({
          message: `${f.displayName} - ${configItem}:`,
          placeholder: "Leave empty to configure later",
        });

        if (p.isCancel(value)) {
          p.cancel("App creation cancelled.");
          process.exit(0);
        }

        configValues[f.id][configItem] = (value as string) || "";
      }
    }
  }

  // Step 7: Confirm
  const allFeatures = allIds
    .map((id) => getFeatureById(id, features))
    .filter((f): f is Feature => f !== undefined);

  const summaryLines = [
    `App:         ${appName as string}`,
    `Description: ${description as string}`,
    `Features:    ${allFeatures.length} selected`,
    "",
    ...allFeatures.map(
      (f) => `  ${statusIcon(f.status)} ${f.displayName} (${f.id})`
    ),
  ];

  p.note(summaryLines.join("\n"), "Summary");

  const confirmed = await p.confirm({
    message: "Generate app manifest?",
  });

  if (p.isCancel(confirmed) || !confirmed) {
    p.cancel("App creation cancelled.");
    process.exit(0);
  }

  // Step 8: Generate manifest
  const manifest = {
    name: appName as string,
    description: description as string,
    createdAt: new Date().toISOString(),
    features: allFeatures.map((f) => ({
      id: f.id,
      name: f.name,
      displayName: f.displayName,
      tier: f.tier,
      package: f.package,
      status: f.status,
    })),
    config: configValues,
    dependencies: allIds,
  };

  const manifestPath = resolve(process.cwd(), `${appName as string}.manifest.json`);
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf-8");

  // Step 9: Success
  p.outro(
    pc.green("Manifest generated!") +
      "\n\n" +
      `  ${pc.bold("Manifest:")} ${manifestPath}\n\n` +
      `  ${pc.bold("Next steps:")}\n` +
      `    1. Review the manifest file\n` +
      `    2. Run ${pc.cyan("hmc generate")} to scaffold the app (coming soon)\n` +
      `    3. Configure environment variables for required features\n` +
      `    4. Run ${pc.cyan("npm install")} and ${pc.cyan("npm run dev")} to start developing`
  );
}

// Main entry point
async function main(): Promise<void> {
  switch (command) {
    case "list":
      listCommand();
      break;
    case "info": {
      const featureId = args[1];
      if (!featureId) {
        console.error(pc.red("  Error: Please provide a feature ID."));
        console.log(pc.dim('  Usage: hmc info <feature-id>  (e.g., hmc info F-001)'));
        process.exit(1);
      }
      infoCommand(featureId);
      break;
    }
    case "search": {
      const query = args.slice(1).join(" ");
      if (!query) {
        console.error(pc.red("  Error: Please provide a search query."));
        console.log(pc.dim('  Usage: hmc search <query>  (e.g., hmc search authentication)'));
        process.exit(1);
      }
      searchCommand(query);
      break;
    }
    case "create":
      await createCommand();
      break;
    case "help":
    case "--help":
    case "-h":
    case undefined:
      printUsage();
      break;
    default:
      console.error(pc.red(`  Unknown command: ${command}`));
      printUsage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(pc.red("Fatal error:"), err);
  process.exit(1);
});
