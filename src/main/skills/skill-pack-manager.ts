import fs from 'node:fs';
import path from 'node:path';

export type SkillPackRuntimeKind = 'codex' | 'claude' | 'opencode';

export type SkillPackManagerErrorCode =
  | 'SKILL_PACK_RUNTIME_ERROR'
  | 'SKILL_PACK_TEMPLATE_ERROR'
  | 'SKILL_PACK_WRITE_ERROR';

export interface CreateSkillPackManagerOptions {
  templateRoot?: string;
}

export interface GenerateSkillPackInput {
  workspaceId: string;
  workspaceRoot: string;
  templateWorkspaceRoot?: string;
  runtimeKind: SkillPackRuntimeKind;
  bridgeUsageHint: string;
  cliUsageHint: string;
}

export interface GeneratedSkillPackFile {
  relativePath: string;
  absolutePath: string;
}

export interface GeneratedSkillPack {
  files: GeneratedSkillPackFile[];
}

export interface SkillPackManager {
  generateSkillPack: (input: GenerateSkillPackInput) => GeneratedSkillPack;
}

interface TemplateDescriptor {
  relativePath: string;
  templatePath: string;
}

interface RollbackEntry {
  file: GeneratedSkillPackFile;
  previousContent: Buffer | null;
}

const TEMPLATE_SETS: Record<SkillPackRuntimeKind, TemplateDescriptor[]> = {
  codex: [
    {
      relativePath: 'AGENTS.md',
      templatePath: 'codex/agents.md.tpl'
    },
    {
      relativePath: '.agents/skills/openweave-workspace.md',
      templatePath: 'codex/openweave-workspace.md.tpl'
    }
  ],
  claude: [
    {
      relativePath: '.claude/skills/openweave-workspace.md',
      templatePath: 'claude/openweave-workspace.md.tpl'
    }
  ],
  opencode: [
    {
      relativePath: 'AGENTS.md',
      templatePath: 'opencode/agents.md.tpl'
    },
    {
      relativePath: '.opencode/skills/openweave-workspace.md',
      templatePath: 'opencode/openweave-workspace.md.tpl'
    }
  ]
};

const PLACEHOLDER_PATTERN = /\{\{([a-zA-Z0-9]+)\}\}/g;

const DEFAULT_TEMPLATE_CONTENT: Record<string, string> = {
  'codex/agents.md.tpl': `# OpenWeave Workspace Guidance

runtime: {{runtimeKind}}
workspace id: {{workspaceId}}
workspace root: {{workspaceRoot}}

bridge hint: {{bridgeUsageHint}}
cli hint: {{cliUsageHint}}
`,
  'codex/openweave-workspace.md.tpl': `# OpenWeave Managed Skill

runtime: {{runtimeKind}}
workspace id: {{workspaceId}}
workspace root: {{workspaceRoot}}

bridge hint: {{bridgeUsageHint}}
cli hint: {{cliUsageHint}}
`,
  'claude/openweave-workspace.md.tpl': `# OpenWeave Managed Skill

runtime: {{runtimeKind}}
workspace id: {{workspaceId}}
workspace root: {{workspaceRoot}}

bridge hint: {{bridgeUsageHint}}
cli hint: {{cliUsageHint}}
`,
  'opencode/agents.md.tpl': `# OpenWeave Workspace Guidance

runtime: {{runtimeKind}}
workspace id: {{workspaceId}}
workspace root: {{workspaceRoot}}

bridge hint: {{bridgeUsageHint}}
cli hint: {{cliUsageHint}}
`,
  'opencode/openweave-workspace.md.tpl': `# OpenWeave Managed Skill

runtime: {{runtimeKind}}
workspace id: {{workspaceId}}
workspace root: {{workspaceRoot}}

bridge hint: {{bridgeUsageHint}}
cli hint: {{cliUsageHint}}
`
};

const loadTemplateContent = (templatePath: string, templateRoot?: string): string => {
  if (!templateRoot) {
    const bundledTemplate = DEFAULT_TEMPLATE_CONTENT[templatePath];
    if (bundledTemplate === undefined) {
      throw new Error(`Missing bundled template: ${templatePath}`);
    }
    return bundledTemplate;
  }

  return fs.readFileSync(path.join(templateRoot, templatePath), 'utf8');
};

const getTemplateSet = (runtimeKind: string): TemplateDescriptor[] => {
  const templateSet = TEMPLATE_SETS[runtimeKind as SkillPackRuntimeKind];
  if (templateSet === undefined) {
    throw new SkillPackManagerError(
      'SKILL_PACK_RUNTIME_ERROR',
      `Skill pack runtime is not supported: ${runtimeKind}`
    );
  }
  return templateSet;
};

const removeEmptyParentDirectories = (workspaceRoot: string, filePath: string): void => {
  let currentPath = path.dirname(filePath);
  while (currentPath.startsWith(workspaceRoot) && currentPath !== workspaceRoot) {
    if (!fs.existsSync(currentPath)) {
      currentPath = path.dirname(currentPath);
      continue;
    }

    if (fs.readdirSync(currentPath).length > 0) {
      break;
    }

    fs.rmdirSync(currentPath);
    currentPath = path.dirname(currentPath);
  }
};

const rollbackGeneratedFiles = (workspaceRoot: string, rollbackEntries: RollbackEntry[]): void => {
  const rollbackTargets = [...rollbackEntries].reverse();
  for (const rollbackEntry of rollbackTargets) {
    const generatedFile = rollbackEntry.file;

    if (!fs.existsSync(generatedFile.absolutePath) && rollbackEntry.previousContent === null) {
      continue;
    }

    if (rollbackEntry.previousContent === null) {
      fs.rmSync(generatedFile.absolutePath, { force: true });
      removeEmptyParentDirectories(workspaceRoot, generatedFile.absolutePath);
      continue;
    }

    fs.mkdirSync(path.dirname(generatedFile.absolutePath), { recursive: true });
    fs.writeFileSync(generatedFile.absolutePath, rollbackEntry.previousContent);
  }
};

const renderTemplate = (templateContent: string, input: GenerateSkillPackInput): string =>
  templateContent.replace(PLACEHOLDER_PATTERN, (_match, placeholderName: string) => {
    switch (placeholderName) {
      case 'workspaceId':
        return input.workspaceId;
      case 'workspaceRoot':
        return path.resolve(input.templateWorkspaceRoot ?? input.workspaceRoot);
      case 'runtimeKind':
        return input.runtimeKind;
      case 'bridgeUsageHint':
        return input.bridgeUsageHint;
      case 'cliUsageHint':
        return input.cliUsageHint;
      default:
        return '';
    }
  });

export class SkillPackManagerError extends Error {
  readonly code: SkillPackManagerErrorCode;

  constructor(code: SkillPackManagerErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'SkillPackManagerError';
    this.code = code;
    if (cause !== undefined) {
      Object.defineProperty(this, 'cause', {
        value: cause,
        enumerable: false,
        configurable: true,
        writable: true
      });
    }
  }
}

export const createSkillPackManager = (
  options: CreateSkillPackManagerOptions = {}
): SkillPackManager => {
  const templateRoot = options.templateRoot;

  return {
    generateSkillPack: (input: GenerateSkillPackInput): GeneratedSkillPack => {
      const workspaceRoot = path.resolve(input.workspaceRoot);
      const generatedFiles: GeneratedSkillPackFile[] = [];
      const rollbackEntries: RollbackEntry[] = [];
      const templateSet = getTemplateSet(input.runtimeKind);

      for (const descriptor of templateSet) {
        let templateContent: string;

        try {
          templateContent = loadTemplateContent(descriptor.templatePath, templateRoot);
        } catch (error) {
          throw new SkillPackManagerError(
            'SKILL_PACK_TEMPLATE_ERROR',
            `Skill pack template could not be loaded: ${descriptor.templatePath}`,
            error
          );
        }

        const outputPath = path.join(workspaceRoot, descriptor.relativePath);
        const renderedContent = renderTemplate(templateContent, input);
        let previousContent: Buffer | null = null;

        try {
          previousContent = fs.existsSync(outputPath) ? fs.readFileSync(outputPath) : null;
          rollbackEntries.push({
            file: {
              relativePath: descriptor.relativePath,
              absolutePath: outputPath
            },
            previousContent
          });
          fs.mkdirSync(path.dirname(outputPath), { recursive: true });
          fs.writeFileSync(outputPath, renderedContent, 'utf8');
        } catch (error) {
          rollbackGeneratedFiles(workspaceRoot, rollbackEntries);
          throw new SkillPackManagerError(
            'SKILL_PACK_WRITE_ERROR',
            `Skill pack file could not be written: ${descriptor.relativePath}`,
            error
          );
        }

        generatedFiles.push({
          relativePath: descriptor.relativePath,
          absolutePath: outputPath
        });
      }

      generatedFiles.sort((left, right) => left.relativePath.localeCompare(right.relativePath));

      return {
        files: generatedFiles
      };
    }
  };
};
