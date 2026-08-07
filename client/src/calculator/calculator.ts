import { Amount } from 'bkper-js';

export type DecimalSeparator = 'DOT' | 'COMMA';

export interface CalculatorFormat {
    decimalSeparator: DecimalSeparator;
    fractionDigits: number;
}

export interface CalculationResult {
    value: Amount;
    formatted: string;
}

export class CalculatorError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'CalculatorError';
    }
}

export function evaluateExpression(
    expression: string,
    format: CalculatorFormat
): CalculationResult {
    const parser = new ExpressionParser(expression, format);
    const value = parser.parse();
    return { value, formatted: formatAmount(value, format) };
}

export function formatAmount(value: Amount, format: CalculatorFormat): string {
    const fixed = value.eq(0)
        ? new Amount(0).toFixed(format.fractionDigits)
        : value.toFixed(format.fractionDigits);
    return format.decimalSeparator === 'DOT' ? fixed : fixed.replace('.', ',');
}

export function formatAbsoluteAmount(value: Amount, format: CalculatorFormat): string {
    return formatAmount(value.abs(), format);
}

export function normalizeExpression(expression: string, format: CalculatorFormat): string {
    let normalized = '';
    let position = 0;

    while (position < expression.length) {
        const character = expression[position];
        if (isNumberCharacter(character)) {
            const start = position;
            while (position < expression.length && isNumberCharacter(expression[position])) {
                position += 1;
            }
            const token = expression.slice(start, position);
            normalized += formatAmount(new Amount(normalizeNumberToken(token, format)), format);
            continue;
        }

        normalized += character;
        position += 1;
    }

    return normalized.replace(/\s+/g, ' ').trim();
}

class ExpressionParser {
    private position = 0;

    constructor(
        private readonly source: string,
        private readonly format: CalculatorFormat
    ) {}

    parse(): Amount {
        this.skipWhitespace();
        if (this.position >= this.source.length) {
            throw new CalculatorError('Enter a calculation.');
        }

        const result = this.parseAddSubtract();
        this.skipWhitespace();

        if (this.position < this.source.length) {
            const character = this.source[this.position];
            if (character === '(' || isNumberCharacter(character)) {
                throw new CalculatorError('Expected an operator between values.');
            }
            throw new CalculatorError(`Unexpected character “${character}”.`);
        }

        return result;
    }

    private parseAddSubtract(): Amount {
        let result = this.parseMultiplyDivide();

        while (true) {
            this.skipWhitespace();
            const operator = this.source[this.position];
            if (operator !== '+' && operator !== '-') {
                return result;
            }

            this.position += 1;
            const right = this.parseMultiplyDivide();
            result = operator === '+' ? result.plus(right) : result.minus(right);
        }
    }

    private parseMultiplyDivide(): Amount {
        let result = this.parseUnary();

        while (true) {
            this.skipWhitespace();
            const operator = this.source[this.position];
            if (operator !== '*' && operator !== '/') {
                return result;
            }

            this.position += 1;
            const right = this.parseUnary();
            if (operator === '*') {
                result = result.times(right);
            } else {
                if (right.eq(0)) {
                    throw new CalculatorError('Division by zero is not allowed.');
                }
                result = result.div(right);
            }
        }
    }

    private parseUnary(): Amount {
        this.skipWhitespace();
        const operator = this.source[this.position];
        if (operator === '+' || operator === '-') {
            this.position += 1;
            const value = this.parseUnary();
            return operator === '-' ? new Amount(0).minus(value) : value;
        }

        return this.parsePrimary();
    }

    private parsePrimary(): Amount {
        this.skipWhitespace();
        if (this.source[this.position] === '(') {
            this.position += 1;
            const value = this.parseAddSubtract();
            this.skipWhitespace();
            if (this.source[this.position] !== ')') {
                throw new CalculatorError('Expected a closing parenthesis.');
            }
            this.position += 1;
            return value;
        }

        return this.parseNumber();
    }

    private parseNumber(): Amount {
        this.skipWhitespace();
        const start = this.position;

        while (
            this.position < this.source.length &&
            isNumberCharacter(this.source[this.position])
        ) {
            this.position += 1;
        }

        if (start === this.position) {
            throw new CalculatorError('Expected a number.');
        }

        const token = this.source.slice(start, this.position);
        return new Amount(normalizeNumberToken(token, this.format));
    }

    private skipWhitespace(): void {
        while (this.position < this.source.length && /\s/.test(this.source[this.position])) {
            this.position += 1;
        }
    }
}

function isNumberCharacter(character: string | undefined): boolean {
    return character !== undefined && /[\d.,]/.test(character);
}

function normalizeNumberToken(token: string, format: CalculatorFormat): string {
    const decimalSeparator = format.decimalSeparator === 'DOT' ? '.' : ',';
    const groupingSeparator = decimalSeparator === '.' ? ',' : '.';
    const decimalIndex = token.indexOf(decimalSeparator);

    if (decimalIndex >= 0) {
        const integerPart = token.slice(0, decimalIndex);
        const fractionalPart = token.slice(decimalIndex + 1);
        if (fractionalPart.includes(groupingSeparator)) {
            throw invalidNumber(token);
        }

        const normalizedInteger = normalizeIntegerPart(integerPart, groupingSeparator, token);
        if (!/^\d*$/.test(fractionalPart)) {
            throw invalidNumber(token);
        }

        return `${normalizedInteger || '0'}.${fractionalPart}`;
    }

    if (token.includes(groupingSeparator)) {
        return normalizeGroupedInteger(token, groupingSeparator);
    }

    if (!/^\d+$/.test(token)) {
        throw invalidNumber(token);
    }

    return token;
}

function normalizeIntegerPart(
    integerPart: string,
    groupingSeparator: string,
    token: string
): string {
    if (integerPart.includes(groupingSeparator)) {
        return normalizeGroupedInteger(integerPart, groupingSeparator);
    }

    if (!/^\d*$/.test(integerPart)) {
        throw invalidNumber(token);
    }

    return integerPart;
}

function normalizeGroupedInteger(token: string, groupingSeparator: string): string {
    const groups = token.split(groupingSeparator);
    if (
        groups.length < 2 ||
        !/^\d{1,3}$/.test(groups[0]) ||
        groups.slice(1).some(group => !/^\d{3}$/.test(group))
    ) {
        throw invalidNumber(token);
    }

    return groups.join('');
}

function invalidNumber(token: string): CalculatorError {
    return new CalculatorError(`Invalid number “${token}”.`);
}
