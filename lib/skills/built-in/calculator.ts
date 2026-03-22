import type { Skill, SkillToolResult } from '../types';

/** Безопасный eval — только математика, никакого JS */
function safeEval(expr: string): number {
  // Разрешаем только: цифры, операторы, скобки, точку, пробелы, Math функции
  const sanitized = expr
    .replace(/[^0-9+\-*/().%\s]/g, '')
    .trim();

  if (!sanitized) throw new Error('Пустое выражение');
  if (sanitized.length > 200) throw new Error('Слишком длинное выражение');

  // eslint-disable-next-line no-new-func
  const result = Function(`"use strict"; return (${sanitized})`)();
  if (typeof result !== 'number' || !isFinite(result)) {
    throw new Error('Результат не является числом');
  }
  return result;
}

export const calculatorSkill: Skill = {
  id: 'calculator',
  name: 'Calculator',
  description: 'Точные математические вычисления и конвертация единиц.',
  version: '1.0.0',
  icon: '🧮',
  category: 'utils',
  author: 'Built-in',
  tags: ['math', 'calculate', 'convert', 'units'],

  tools: [
    {
      name: 'calculate',
      description:
        'Вычисляет математическое выражение. Используй для точных расчётов: арифметика, проценты, формулы. НЕ считай в уме — используй этот инструмент.',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description:
              'Математическое выражение. Примеры: "2 + 2", "15 * 8.5", "(100 - 20) / 4", "2 ** 10"',
          },
          description: {
            type: 'string',
            description: 'Что вычисляем (для контекста в ответе)',
          },
        },
        required: ['expression'],
      },
    },
    {
      name: 'convert_units',
      description: 'Конвертирует единицы измерения: температура, длина, вес, объём, скорость.',
      parameters: {
        type: 'object',
        properties: {
          value: {
            type: 'number',
            description: 'Значение для конвертации',
          },
          from_unit: {
            type: 'string',
            description: 'Единица источника (например: km, celsius, kg, mph)',
          },
          to_unit: {
            type: 'string',
            description: 'Целевая единица (например: miles, fahrenheit, lbs, kmh)',
          },
        },
        required: ['value', 'from_unit', 'to_unit'],
      },
    },
  ],

  async onToolCall(toolName, args): Promise<SkillToolResult> {
    if (toolName === 'calculate') {
      const expr = args.expression as string;
      const desc = args.description as string | undefined;

      try {
        const result = safeEval(expr);
        const formatted = Number.isInteger(result)
          ? result.toLocaleString('ru-RU')
          : result.toLocaleString('ru-RU', { maximumFractionDigits: 10 });

        return {
          mode: 'respond',
          response: {
            expression: expr,
            result,
            formatted,
            description: desc || null,
          },
        };
      } catch (err) {
        return {
          mode: 'respond',
          response: {
            expression: expr,
            error: String(err),
          },
        };
      }
    }

    if (toolName === 'convert_units') {
      const value = args.value as number;
      const from = (args.from_unit as string).toLowerCase().trim();
      const to = (args.to_unit as string).toLowerCase().trim();

      const conversions: Record<string, Record<string, (v: number) => number>> = {
        // Температура
        celsius: {
          fahrenheit: v => v * 9 / 5 + 32,
          kelvin: v => v + 273.15,
        },
        fahrenheit: {
          celsius: v => (v - 32) * 5 / 9,
          kelvin: v => (v - 32) * 5 / 9 + 273.15,
        },
        kelvin: {
          celsius: v => v - 273.15,
          fahrenheit: v => (v - 273.15) * 9 / 5 + 32,
        },
        // Длина
        km: { miles: v => v * 0.621371, m: v => v * 1000, cm: v => v * 100000, ft: v => v * 3280.84 },
        miles: { km: v => v * 1.60934, m: v => v * 1609.34, ft: v => v * 5280 },
        m: { km: v => v / 1000, cm: v => v * 100, ft: v => v * 3.28084, inches: v => v * 39.3701 },
        cm: { m: v => v / 100, inches: v => v / 2.54, km: v => v / 100000 },
        ft: { m: v => v / 3.28084, inches: v => v * 12, km: v => v / 3280.84, miles: v => v / 5280 },
        inches: { cm: v => v * 2.54, ft: v => v / 12, m: v => v / 39.3701 },
        // Вес
        kg: { lbs: v => v * 2.20462, g: v => v * 1000, oz: v => v * 35.274 },
        lbs: { kg: v => v / 2.20462, oz: v => v * 16, g: v => v * 453.592 },
        g: { kg: v => v / 1000, oz: v => v / 28.3495 },
        oz: { g: v => v * 28.3495, lbs: v => v / 16, kg: v => v / 35.274 },
        // Объём
        l: { ml: v => v * 1000, gallons: v => v * 0.264172, fl_oz: v => v * 33.814 },
        ml: { l: v => v / 1000, fl_oz: v => v / 29.5735 },
        gallons: { l: v => v * 3.78541, ml: v => v * 3785.41, fl_oz: v => v * 128 },
        fl_oz: { ml: v => v * 29.5735, l: v => v / 33.814 },
        // Скорость
        kmh: { mph: v => v * 0.621371, ms: v => v / 3.6, knots: v => v * 0.539957 },
        mph: { kmh: v => v * 1.60934, ms: v => v * 0.44704, knots: v => v * 0.868976 },
        ms: { kmh: v => v * 3.6, mph: v => v * 2.23694 },
        // Площадь
        sqm: { sqft: v => v * 10.7639, sqkm: v => v / 1000000, acres: v => v / 4046.86 },
        sqft: { sqm: v => v / 10.7639, sqkm: v => v / 10764000 },
        acres: { sqm: v => v * 4046.86, sqft: v => v * 43560 },
      };

      const converter = conversions[from]?.[to];
      if (!converter) {
        // Попробуем обратное
        const reverseConverter = conversions[to]?.[from];
        if (reverseConverter) {
          // Это означает что from и to перепутаны? Нет, просто не нашли
        }
        return {
          mode: 'respond',
          response: {
            error: `Не знаю как конвертировать ${from} → ${to}`,
            supported_from: Object.keys(conversions),
          },
        };
      }

      const result = converter(value);
      return {
        mode: 'respond',
        response: {
          original: `${value} ${from}`,
          result: Number(result.toFixed(6)),
          formatted: `${Number(result.toFixed(6)).toLocaleString('ru-RU')} ${to}`,
          from_unit: from,
          to_unit: to,
        },
      };
    }

    return { mode: 'respond', response: { error: 'Unknown tool' } };
  },
};
