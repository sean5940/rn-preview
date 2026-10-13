import type { Symbol as TypeSymbol, Type } from 'ts-morph';
import type { ComponentAnalysis, QueryUsage } from './analyzeComponent.ts';
import { enumMemberValue, firstLiteralValue, toMockLiteral } from './mockLiteral.ts';

const MAX_VARIANTS = 5;

/**
 * Props worth filling even when they are not required, so that something shows on screen.
 *
 * Fill only the required ones and every string comes out blank, which makes a draft impossible to
 * read for layout.
 */
const CONTENT_PROPS = /^(title|label|description|content|text|message|placeholder)$/;

/**
 * Props not to use as a variant axis.
 *
 * Layout and style have nothing to do with what a component shows. Spread as an axis, things like
 * `alignSelf` fill the variant list and push out what you actually wanted to see.
 */
const LAYOUT_PROPS =
    /^(style|layoutStyle|align|justify|flex|width|height|margin|padding|position|top|bottom|left|right|zIndex|gap|row|column)/;

const constName = (usage: QueryUsage): string => {
    const method = usage.expression.split('.').pop()?.replace(/\(.*$/, '') ?? 'DATA';
    return method
        .replace(/^get/, '')
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .toUpperCase();
};

/** TypeScript prints string literals with double quotes. This repository uses single quotes. */
const toSingleQuoted = (text: string): string => text.replace(/^"(.*)"$/, "'$1'");

/**
 * Turns a variant name into an object key.
 *
 * Using a union member verbatim produces things that cannot be identifiers, such as `1:1` or `4:3`.
 * Hangul is valid in an identifier, so it is left as is for projects that name variants in Korean.
 */
const toVariantKey = (label: string): string => (/^[A-Za-z_$가-힣][\w$가-힣]*$/.test(label) ? label : `'${label}'`);

const declaredType = (property: TypeSymbol): Type | undefined =>
    property.getValueDeclaration()?.getType() ?? property.getDeclarations()[0]?.getType();

/**
 * The value to put in one prop.
 *
 * `children` alone is decided by name rather than by type. Its type is `ReactNode`, so going by the
 * type produces an element tree when what is actually wanted is the string that goes in that slot.
 *
 * Only filled when required. Filling an inherited `children` as well, the kind `TextInputProps`
 * drags in, prints the string in the wrong place.
 */
const propValue = (property: TypeSymbol): string => {
    if (property.getName() === 'children') return "'Text'";

    const type = declaredType(property);
    return type === undefined ? 'undefined' : toMockLiteral(type, property.getName(), 3);
};

const buildProps = (type: Type): (readonly [string, string])[] =>
    type
        .getProperties()
        .filter((property) => !property.isOptional() || CONTENT_PROPS.test(property.getName()))
        // A union member sometimes carries `label?: undefined` to mean "absent in this variant".
        .filter((property) => declaredType(property)?.isUndefined() !== true)
        .map((property) => [property.getName(), propValue(property)] as const);

const toObjectBody = (entries: readonly (readonly [string, string])[]): string =>
    entries.map(([name, value]) => `${name}: ${value}`).join(', ');

const literalMembers = (type: Type): string[] =>
    type.isUnion()
        ? type
              .getUnionTypes()
              .filter((member) => member.isStringLiteral())
              .map((member) => toSingleQuoted(member.getText()))
        : [];

const literalOf = (member: Type, name: string): string | undefined => {
    const property = member.getProperty(name);
    const type = property === undefined ? undefined : declaredType(property);
    return type === undefined ? undefined : firstLiteralValue(type)?.replace(/'/g, '');
};

/**
 * Name of the prop that tells union members apart. The `type` in `type: 'filter' | 'action' | …`.
 *
 * It must not be picked as "the first literal prop". If a prop whose value is the same across every
 * member comes first, all the variant names become identical and **the object keys collide so only
 * the last one survives.** Only a prop whose value differs per member is a discriminant.
 */
const discriminantName = (members: Type[]): string | undefined =>
    members[0]
        ?.getProperties()
        .map((property) => property.getName())
        .find((name) => {
            const labels = members.map((member) => literalOf(member, name));
            return labels.every((label) => label !== undefined) && new Set(labels).size === members.length;
        });

/**
 * When props are a union, emits one variant per member.
 *
 * A discriminated union is the type-level record of how many shapes a component is used in.
 * Collecting only the shared properties drops each shape's required prop entirely, such as a chip's
 * `title`, and yields a blank cell.
 */
const unionVariants = (members: Type[]): string => {
    const name = discriminantName(members);

    return members
        .slice(0, MAX_VARIANTS)
        .map((member, index) => {
            const label = (name === undefined ? undefined : literalOf(member, name)) ?? `variant${index + 1}`;
            return `        ${toVariantKey(label)}: { ${toObjectBody(buildProps(member))} },`;
        })
        .join('\n');
};

/**
 * Builds a variant draft from the props type.
 *
 * Unions are split per member, booleans into true and false. Which of those is actually worth
 * looking at is something a person knows. Here they are merely spread so no axis is missing, and
 * names and values are left to be refined.
 */
const buildVariants = (propsType: Type | undefined): string => {
    if (propsType === undefined) return '        default: {},';

    const members = (propsType.isUnion() ? propsType.getUnionTypes() : []).filter(
        (member) => member.getProperties().length > 0,
    );
    if (members.length > 1) return unionVariants(members);

    // An intersection type (`Props & LayoutStyleProp`) reports isObject as false. Go by whether it has properties.
    const properties = propsType.getProperties();
    if (properties.length === 0) return '        default: {},';

    const base = buildProps(propsType);
    const lines = [`        default: { ${toObjectBody(base)} },`];
    const usedKeys = new Set(['default']);

    for (const property of properties) {
        if (lines.length > MAX_VARIANTS) break;
        if (LAYOUT_PROPS.test(property.getName())) continue;

        const type = declaredType(property);
        if (type === undefined) continue;

        for (const member of literalMembers(type).slice(0, 2)) {
            if (lines.length > MAX_VARIANTS) break;

            // If the same prop is also in the base values, the key appears twice. Keep only the overriding one.
            const kept = base.filter(([name]) => name !== property.getName());
            const entries = [...kept, [property.getName(), member] as const];

            // Two props with the same value collide by name too. Prefix the prop name only then.
            const plain = member.replace(/'/g, '');
            const label = usedKeys.has(plain) ? `${property.getName()}_${plain}` : plain;
            usedKeys.add(label);

            lines.push(`        ${toVariantKey(label)}: { ${toObjectBody(entries)} },`);
        }
    }

    return lines.join('\n');
};

/**
 * Finds states that branch on an enum.
 *
 * This is the most common axis by which a screen varies with data. A single enum field, such as a
 * subscription status or an order status, changes the whole screen. Member names are used as state
 * names verbatim; a person is better placed to give them readable names.
 */
const enumStates = (usage: QueryUsage): { label: string; property: string; value: string }[] => {
    const properties = usage.dataType?.getProperties() ?? [];

    return properties.flatMap((property) => {
        const type = declaredType(property);
        const members = type?.isUnion() === true ? type.getUnionTypes() : [];

        const values = members.flatMap((member) => {
            const value = enumMemberValue(member);
            const label = member.getSymbol()?.getName();
            return value === undefined || label === undefined ? [] : [{ label, property: property.getName(), value }];
        });

        return values.length >= 2 ? values : [];
    });
};

/**
 * Finds states in a query whose response is itself a literal union.
 *
 * The case where one response is the state, such as `'active' | 'inactive'`. `enumStates`, which
 * digs through fields, misses this because a union has no properties.
 */
const literalStates = (usage: QueryUsage): { label: string; value: string }[] => {
    const type = usage.dataType;
    const members = type?.isUnion() === true ? type.getUnionTypes() : [];

    return members.flatMap((member) => {
        const literal = member.isStringLiteral() ? toSingleQuoted(member.getText()) : undefined;
        const value = enumMemberValue(member) ?? literal;
        return value === undefined ? [] : [{ label: value.replace(/'/g, ''), value }];
    });
};

const buildScreenBody = (analysis: ComponentAnalysis): string[] => {
    const { queries } = analysis;
    const first = queries[0];

    const whole =
        first === undefined
            ? []
            : literalStates(first)
                  .slice(0, MAX_VARIANTS)
                  .map(
                      ({ label, value }) =>
                          `        ${toVariantKey(label)}: [{ key: ${first.expression}.queryKey, data: ${value} }],`,
                  );

    // If the states already cover every value of that query, the base response is used by no cell.
    // The same line appearing twice makes it unclear which one to edit.
    const base = whole.length > 0 ? queries.filter((usage) => usage !== first) : queries;

    const constants = base.map((usage) => {
        const value = usage.dataType === undefined ? 'undefined' : toMockLiteral(usage.dataType, constName(usage));
        return `const ${constName(usage)} = ${value};`;
    });

    const mocks = base.map((usage) => `        { key: ${usage.expression}.queryKey, data: ${constName(usage)} },`);

    const fields =
        first === undefined
            ? []
            : enumStates(first)
                  .slice(0, MAX_VARIANTS)
                  .map(
                      ({ label, property, value }) =>
                          `        ${label}: [{ key: ${first.expression}.queryKey, data: { ...${constName(
                              first,
                          )}, ${property}: ${value} } }],`,
                  );

    const branches = whole.length > 0 ? whole : fields;

    const states =
        first === undefined
            ? []
            : [
                  '    states: {',
                  ...branches,
                  `        loading: [{ key: ${first.expression}.queryKey, pending: true }],`,
                  `        fetchFailed: [{ key: ${first.expression}.queryKey, error: new Error('Could not load') }],`,
                  '    },',
              ];

    return [
        ...constants,
        ...(constants.length === 0 ? [] : ['']),
        'export default definePreview({',
        `    component: ${analysis.name},`,
        '    variants: {',
        '        default: {},',
        '    },',
        ...(analysis.usesNavigation ? [`    route: { name: '${analysis.name}', params: {} },`] : []),
        ...(mocks.length === 0 ? [] : ['    mockQueries: [', ...mocks, '    ],']),
        ...states,
        '});',
    ];
};

const buildComponentBody = (analysis: ComponentAnalysis): string[] => [
    'export default definePreview({',
    `    component: ${analysis.name},`,
    '    variants: {',
    buildVariants(analysis.propsType),
    '    },',
    '});',
];

/**
 * The note placed at the top of a draft.
 *
 * From the draft alone it is hard to tell what needs editing and what may be written at all. It is
 * especially easy to invent **plausible names that do not exist**, such as `hooks` or `mockups`, so
 * the note records that the `definePreview` type is the whole vocabulary and how to check. Delete
 * it once everything is filled in.
 */
const guide = (isScreen: boolean): string[] => [
    // Written as a block comment: as JSDoc it would attach to the constant below and follow it on every hover.
    '/*',
    ' * Preview declaration draft. Delete this comment once the values are filled in.',
    ' *',
    ` * - variants: the props axis. ${
        isScreen ? 'Screens take no props, so usually a single `default`.' : 'Delete variants not worth seeing.'
    }`,
    isScreen
        ? ' * - states: the server-response axis. A screen varies by data, not props.'
        : ' * - If the component varies by data, add mockQueries and states.',
    " * - 'string' and 0 are shape-only placeholders. Replace them with values you actually want to see,",
    ' *   otherwise layout and copy cannot be judged.',
    ' * - A blank cell with no error means the flag is closed. Name the group with `abTestGroups`.',
    ' * - Also available: widths, height, background, openOnMount. Hover `definePreview` for the full list.',
    ' * - The `definePreview` type is the whole vocabulary. Any name not in it is caught by type checking.',
    ' * - Check with: npm run typecheck:previews',
    ' */',
];

/**
 * Writes a declaration draft.
 *
 * It is a draft. What the values mean, and which states are worth seeing, is filled in by a person
 * or an agent. What is produced here is the skeleton of "what to draw and what needs filling in".
 */
export const renderPreview = (analysis: ComponentAnalysis): string => {
    const isScreen = analysis.queries.length > 0;

    const queryImports = [
        ...new Set(analysis.queries.map((usage) => `import { ${usage.rootName} } from '${usage.importFrom}';`)),
    ];

    const header = [
        "import { definePreview } from '@preview';",
        ...queryImports,
        `import { ${analysis.name} } from '${analysis.importSpecifier}';`,
        '',
    ];

    return [
        ...header,
        ...guide(isScreen),
        ...(isScreen ? buildScreenBody(analysis) : buildComponentBody(analysis)),
        '',
    ].join('\n');
};
