import { DEFAULT_RULES } from '../src/core/types';
import { CodeCompilerService } from '../src/services/codeCompilerService';
import { CSHARP_TEMPLATE } from '../src/services/csharpTemplate';

const service = new CodeCompilerService();

const base = service.compile(CSHARP_TEMPLATE);
if (!base.success) {
  throw new Error(`Numatytas C# šablonas nesikompiliuoja: ${base.errors.join(' | ')}`);
}

const mismatch: string[] = [];
for (const key of Object.keys(DEFAULT_RULES) as Array<keyof typeof DEFAULT_RULES>) {
  if (base.rules[key] !== DEFAULT_RULES[key]) {
    mismatch.push(`${String(key)}: ${String(base.rules[key])} != ${String(DEFAULT_RULES[key])}`);
  }
}
if (mismatch.length > 0) {
  throw new Error(`Numatyto šablono taisyklės neatitinka DEFAULT_RULES:\n${mismatch.join('\n')}`);
}

const broken = CSHARP_TEMPLATE.replace('public class DanceRules', 'public class DanceRules BROKEN');
const brokenResult = service.compile(broken);
if (brokenResult.success) {
  throw new Error('Sugadintas C# kodas netikėtai laikomas galiojančiu.');
}

console.log('Compiler contract OK: template compiles, defaults match, broken code fails.');
