import { describe, expect, it } from 'bun:test';
import {
    CalculatorError,
    evaluateExpression,
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

    it('normalizes history expressions to the Book format', () => {
        expect(normalizeExpression('  1,000   +   2,000  ', dotFormat)).toBe('1000.00 + 2000.00');
        expect(normalizeExpression('1.000,5 + 2,5', commaFormat)).toBe('1000,500 + 2,500');
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
