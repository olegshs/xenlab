import { AppError } from '../errors';
import { ratioToCents } from './frequency';

export interface ScalaScale {
  description: string;
  /** Degree values in cents (without 1/1); the last one is the period. */
  pitches: number[];
}

/**
 * Parses a single pitch value in Scala syntax:
 * with a decimal point it is cents ("701.955"), otherwise a ratio ("3/2") or an integer ("2").
 */
export function parsePitch(raw: string): number {
  const token = raw.trim().split(/\s+/)[0];
  if (!token) throw new AppError('err.emptyValue');
  if (token.includes('.')) {
    const c = Number(token);
    if (!Number.isFinite(c)) throw new AppError('err.badCents', { token });
    return c;
  }
  const [a, b = '1'] = token.split('/');
  const p = Number(a);
  const q = Number(b);
  if (!Number.isFinite(p) || !Number.isFinite(q) || p <= 0 || q <= 0) {
    throw new AppError('err.badRatio', { token });
  }
  return ratioToCents(p / q);
}

export function parseScala(text: string): ScalaScale {
  const lines = text.split(/\r?\n/).filter((l) => !l.startsWith('!'));
  if (lines.length < 2) throw new AppError('err.sclTooShort');
  const description = lines[0].trim();
  const count = parseInt(lines[1].trim(), 10);
  if (!Number.isInteger(count) || count <= 0) throw new AppError('err.sclBadCount');
  const values = lines
    .slice(2)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (values.length < count) {
    throw new AppError('err.sclMissing', { expected: count, found: values.length });
  }
  const pitches = values.slice(0, count).map(parsePitch);
  return { description, pitches };
}

export function toScala(description: string, stepsCents: number[], periodCents: number): string {
  const pitches = [...stepsCents.slice(1), periodCents];
  return [
    '! exported from XenLab',
    '!',
    description,
    ` ${pitches.length}`,
    '!',
    ...pitches.map((c) => ` ${c.toFixed(6)}`),
    '',
  ].join('\n');
}
