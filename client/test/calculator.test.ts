import { describe, expect, it } from 'bun:test';
import {
    CalculatorError,
    evaluateExpression,
    formatAbsoluteAmount,
    formatAmount,
    normalizeExpression,
    type CalculatorFormat,
} from '../src/calculator/calculator';

const dotFormat: CalculatorFormat = {
    decimalSeparator: 'DOT',
    fractionDigits: 2,
};

const commaFormat: CalculatorFormat = {
    decimalSeparator: 'COMMA',
    fractionDigits: 3,
};

describe('calculator engine', () => {
    it('applies mathematical precedence and parentheses', () => {
        expect(evaluateExpression('2 + 3 * 4', dotFormat).formatted).toBe('14.00');
        expect(evaluateExpression('(2 + 3) * 4', dotFormat).formatted).toBe('20.00');
    });

    it('uses exact decimal arithmetic', () => {
        expect(evaluateExpression('0.1 + 0.2', dotFormat).formatted).toBe('0.30');
    });

    it('supports unary signs and shorthand decimals', () => {
        expect(evaluateExpression('-.5 + 5.', dotFormat).formatted).toBe('4.50');
    });

    it('accepts locale-aware grouped numbers', () => {
        expect(evaluateExpression('1,000 + 2,000', dotFormat).value.toString()).toBe('3000');
        expect(evaluateExpression('1.000,000 + 2.000,000', commaFormat).value.toString()).toBe(
            '3000'
        );
    });

    it('rejects grouping that conflicts with the book locale', () => {
        expect(() => evaluateExpression('1,00', dotFormat)).toThrow(CalculatorError);
        expect(() => evaluateExpression('1.00', commaFormat)).toThrow(CalculatorError);
        expect(() => evaluateExpression('1,234.56', commaFormat)).toThrow(CalculatorError);
    });

    it('rounds only the final displayed result', () => {
        expect(evaluateExpression('1 / 3 * 3', dotFormat).formatted).toBe('1.00');
        expect(evaluateExpression('1 / 3', dotFormat).value.toString()).toBe(
            '0.33333333333333333333'
        );
        expect(evaluateExpression('1 / 3', dotFormat).formatted).toBe('0.33');
    });

    it('reports division by zero and malformed expressions', () => {
        expect(() => evaluateExpression('10 / 0', dotFormat)).toThrow('Division by zero');
        expect(() => evaluateExpression('3000 +', dotFormat)).toThrow('Expected a number');
        expect(() => evaluateExpression('2(3 + 4)', dotFormat)).toThrow('Expected an operator');
    });

    it('rejects a separator without digits', () => {
        expect(() => evaluateExpression('.', dotFormat)).toThrow(CalculatorError);
        expect(() => evaluateExpression(',', commaFormat)).toThrow(CalculatorError);
        expect(() => evaluateExpression('1 + .', dotFormat)).toThrow(CalculatorError);
    });

    it('never displays a negative zero', () => {
        expect(evaluateExpression('1 / 3 * 3 - 1', dotFormat).formatted).toBe('0.00');
        expect(evaluateExpression('-0.001', dotFormat).formatted).toBe('0.00');
        expect(evaluateExpression('-0,0001', commaFormat).formatted).toBe('0,000');
        expect(
            evaluateExpression('-0.4', { decimalSeparator: 'DOT', fractionDigits: 0 }).formatted
        ).toBe('0');
        expect(evaluateExpression('-0.006', dotFormat).formatted).toBe('-0.01');
    });

    it('uses exactly the fraction digits configured on the Book', () => {
        const digitsCases: [number, string, string][] = [
            [0, '3', '2'],
            [2, '3.33', '2.23'],
            [3, '3.333', '2.235'],
            [8, '3.33333333', '2.23456789'],
        ];

        for (const [fractionDigits, division, addition] of digitsCases) {
            const format: CalculatorFormat = { decimalSeparator: 'DOT', fractionDigits };
            expect(evaluateExpression('10 / 3', format).formatted).toBe(division);
            expect(evaluateExpression('1.23456789 + 1', format).formatted).toBe(addition);
        }
    });

    it('keeps history expressions as typed so restoring them reproduces the result', () => {
        const zeroDigitFormat: CalculatorFormat = { decimalSeparator: 'DOT', fractionDigits: 0 };
        const cases: [string, CalculatorFormat][] = [
            ['0.125 * 8', dotFormat],
            ['2.5 + 2.5', zeroDigitFormat],
            ['1.000,0005 * 2', commaFormat],
        ];

        for (const [expression, format] of cases) {
            const restored = normalizeExpression(expression);
            expect(evaluateExpression(restored, format).formatted).toBe(
                evaluateExpression(expression, format).formatted
            );
        }

        expect(normalizeExpression('  1,000   +   2,000  ')).toBe('1,000 + 2,000');
    });

    it('formats absolute result values for copying', () => {
        const format: CalculatorFormat = {
            decimalSeparator: 'DOT',
            fractionDigits: 3,
        };
        const result = evaluateExpression('458.730 - 496.370', format);

        expect(result.formatted).toBe('-37.640');
        expect(formatAbsoluteAmount(result.value, format)).toBe('37.640');
    });

    it('formats values using the book separator and fraction digits', () => {
        expect(formatAmount(evaluateExpression('3000 - 2000', dotFormat).value, dotFormat)).toBe(
            '1000.00'
        );
        expect(
            formatAmount(evaluateExpression('3000 - 2000', commaFormat).value, commaFormat)
        ).toBe('1000,000');
    });
});
