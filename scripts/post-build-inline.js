const fs = require('fs');
const path = require('path');

const rootDir = process.cwd();

const targets = [
  {
    name: 'drone',
    processorPath: 'packages/drone-sonifier/src/DroneResonatorProcessor.js',
    distDir: 'packages/drone-sonifier/dist',
    targetString: '/packages/drone-sonifier/src/DroneResonatorProcessor.js',
  },
  {
    name: 'liquid',
    processorPath: 'packages/liquid/src/LiquidResonatorProcessor.js',
    distDir: 'packages/liquid/dist',
    targetString: '/packages/liquid/src/LiquidResonatorProcessor.js',
  }
];

function inlineProcessors() {
  console.log('Starting AudioWorklet processor inlining...');

  for (const target of targets) {
    const processorFile = path.join(rootDir, target.processorPath);
    if (!fs.existsSync(processorFile)) {
      console.error(`Processor file not found: ${processorFile}`);
      process.exit(1);
    }

    const rawCode = fs.readFileSync(processorFile, 'utf8');
    // Escape template literal characters
    const escapedCode = rawCode
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .replace(/\${/g, '\\${');

    const filesToPatch = ['index.js', 'index.cjs', 'index.global.js'];

    for (const fileName of filesToPatch) {
      const filePath = path.join(rootDir, target.distDir, fileName);
      if (!fs.existsSync(filePath)) {
        console.log(`Skipping optional file: ${filePath}`);
        continue;
      }

      let content = fs.readFileSync(filePath, 'utf8');

      // Target the constructor line and replace it with Blob URL generator
      const targetPattern = new RegExp(`constructor\\s*\\(\\s*processorUrl\\s*=\\s*["']${escapeRegExp(target.targetString)}["']\\s*\\)\\s*{`, 'g');

      const replacement = `constructor(processorUrl) {
    if (!processorUrl && typeof window !== "undefined" && typeof URL !== "undefined" && typeof Blob !== "undefined") {
      const code = \`${escapedCode}\`;
      const blob = new Blob([code], { type: "application/javascript" });
      processorUrl = URL.createObjectURL(blob);
    } else if (!processorUrl) {
      processorUrl = "${target.targetString}";
    } \n`;

      if (content.match(targetPattern)) {
        content = content.replace(targetPattern, replacement);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Successfully inlined ${target.name} processor in ${filePath}`);
      } else {
        console.warn(`Warning: Target constructor pattern not found in ${filePath}`);
      }
    }
  }
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

inlineProcessors();
