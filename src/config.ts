import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { ConfigSchema, SemanticOpsConfig } from './config.schema';

export class ConfigError extends Error {}

export function formatZodError(err: { issues: Array<{ path: (string | number)[]; message: string }> }): string {
  return err.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
}

export function parseConfig(raw: unknown): SemanticOpsConfig {
  const result = ConfigSchema.safeParse(raw ?? {});
  if (!result.success) {
    throw new ConfigError(`Invalid semantic-ops config:\n${formatZodError(result.error)}`);
  }
  return result.data;
}

export function loadConfig(configPath: string): SemanticOpsConfig {
  if (!fs.existsSync(configPath)) {
    throw new ConfigError(
      `Config file not found at "${configPath}". Create a semantic-ops.yml at your repo root, or set the "config_path" input to point at your config file.`,
    );
  }

  const raw = fs.readFileSync(configPath, 'utf8');
  let parsed: unknown;
  try {
    parsed = yaml.load(raw);
  } catch (err) {
    throw new ConfigError(`Failed to parse "${configPath}" as YAML: ${(err as Error).message}`);
  }

  return parseConfig(parsed);
}
