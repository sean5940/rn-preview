import type { Type } from 'ts-morph';

const MAX_DEPTH = 6;

/** A value that gets rendered. Its properties cannot be invented. */
const RENDERABLE = /\b(ReactElement|ReactNode|JSX\.Element|ReactPortal)\b/;

const indent = (depth: number): string => '    '.repeat(depth);

/** Picks a plausible example string from the name. A person refines it later, so it only has to convey the sense. */
const sampleString = (name: string): string => {
    if (/(date|at|time)$/i.test(name)) return '2026-09-11T00:00:00+09:00';
    if (/url|uri|link/i.test(name)) return 'https://example.com';
    if (/name|title|label/i.test(name)) return 'Name';
    if (/description|content|message|text/i.test(name)) return 'Description text';
    return 'string';
};

/**
 * For an enum member, `getText()` comes out as `import("...").Enum.MEMBER`. That cannot be written
 * into a declaration file as is, so the value is used instead. It also keeps the declaration short
 * by not requiring the enum to be imported.
 */
export const enumMemberValue = (type: Type): string | undefined => {
    if (!type.isEnumLiteral()) return undefined;

    const value = type.getLiteralValue();
    return typeof value === 'string' ? `'${value}'` : String(value ?? '');
};

export const firstLiteralValue = (type: Type): string | undefined => {
    const union = type.isUnion() ? type.getUnionTypes() : [type];

    const enumMember = union.map(enumMemberValue).find((value) => value !== undefined);
    if (enumMember !== undefined) return enumMember;

    const literal = union.find((member) => member.isStringLiteral() || member.isNumberLiteral());
    return literal === undefined ? undefined : literal.getText().replace(/^"(.*)"$/, "'$1'");
};

/**
 * Builds a mock value literal from a type.
 *
 * What the values mean is unknowable here. This is a shape-only draft, and what you want to look at
 * is filled in by a person or an agent. Even so, field names and types alone produce enough for the
 * screen to render.
 */
export const toMockLiteral = (type: Type, name = '', depth = 0): string => {
    if (depth > MAX_DEPTH) return 'undefined';

    const literal = firstLiteralValue(type);
    if (literal !== undefined) return literal;

    // A callback has nothing to do in a preview. Making it an object fails the type, and omitting it kills the screen.
    if (type.getCallSignatures().length > 0) return '() => undefined';

    // An element's properties cannot be mimicked. Inventing `{ type, props, key }` crashes mid-render.
    // What to put there is a person's call, so it is left empty; if it was required, type checking points at the spot.
    if (RENDERABLE.test(type.getText())) return 'undefined';

    if (type.isBoolean() || type.isBooleanLiteral()) return 'false';
    if (type.isNumber()) return '0';
    if (type.isString()) return `'${sampleString(name)}'`;

    if (type.isArray()) {
        const element = type.getArrayElementType();
        if (element === undefined) return '[]';
        // An empty list makes that spot vanish from the screen, so the layout cannot be seen. Fill one.
        return `[${toMockLiteral(element, name, depth + 1)}]`;
    }

    if (type.isUnion()) {
        const meaningful = type.getUnionTypes().find((member) => !member.isNull() && !member.isUndefined());
        return meaningful === undefined ? 'null' : toMockLiteral(meaningful, name, depth + 1);
    }

    if (type.isObject()) {
        const properties = type.getProperties();
        if (properties.length === 0) return '{}';

        const lines = properties.map((property) => {
            const propertyType = property.getValueDeclaration()?.getType() ?? property.getDeclarations()[0]?.getType();
            const value =
                propertyType === undefined ? 'undefined' : toMockLiteral(propertyType, property.getName(), depth + 1);
            return `${indent(depth + 1)}${property.getName()}: ${value},`;
        });

        return ['{', ...lines, `${indent(depth)}}`].join('\n');
    }

    return 'undefined';
};
