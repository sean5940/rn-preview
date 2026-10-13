import { basename, dirname, relative, sep } from 'node:path';
import { Node, Project, SyntaxKind } from 'ts-morph';
import type { SourceFile, Type } from 'ts-morph';
import { MOBILE_APP_ROOT } from './mobileAppPath.ts';
import { toPreviewPath } from './previewPath.ts';
import { readBaseUrlDirectories, readMobileAppPaths, readProjectTsconfig } from './projectTsconfig.ts';

export type QueryUsage = {
    /** The expression to copy verbatim into a declaration. `subscriptionQueries.get()` */
    expression: string;
    /** Where the root identifier of that expression is imported from. */
    importFrom: string;
    rootName: string;
    dataType: Type | undefined;
};

export type ComponentAnalysis = {
    name: string;
    importSpecifier: string;
    propsType: Type | undefined;
    queries: QueryUsage[];
    usesNavigation: boolean;
    usesSafeArea: boolean;
};

const isPascalCase = (name: string): boolean => /^[A-Z]/.test(name);

/**
 * Converts a source path into the aliased import the target project uses.
 *
 * A relative path would not resolve, because declaration files live outside the target project. The
 * alias list is read from that project's tsconfig rather than copied here.
 */
export const toAliasSpecifier = (sourcePath: string): string => {
    const withoutExtension = sourcePath.replace(/\.tsx?$/, '');
    const fromRoot = relative(MOBILE_APP_ROOT, withoutExtension);
    const paths = readMobileAppPaths();

    const candidates = Object.entries(paths).flatMap(([key, targets]) => {
        const target = targets[0];
        if (target === undefined) return [];

        const prefix = toTargetPrefix(target);
        if (!fromRoot.startsWith(prefix)) return [];

        const aliasPrefix = key.endsWith('/*') ? key.slice(0, -1) : `${key}/`;
        return [{ length: prefix.length, specifier: `${aliasPrefix}${fromRoot.slice(prefix.length)}` }];
    });

    const best = candidates.sort((a, b) => b.length - a.length)[0];
    return best?.specifier ?? toUnaliasedSpecifier(sourcePath, withoutExtension);
};

/** The directory an alias target covers, ending in `/`. Empty for the project root (`"@/*": ["./*"]`). */
const toTargetPrefix = (target: string): string => {
    const directory = target.endsWith('/*') ? target.slice(0, -2) : target === '*' ? '.' : target.replace(/\/$/, '');
    return directory === '.' ? '' : `${directory}/`;
};

/**
 * The import for a source no alias covers.
 *
 * Through `baseUrl` when the file sits in a directory reached that way, as the project itself would
 * write it. Otherwise relative to the declaration, which resolves wherever the declaration
 * directory sits.
 */
const toUnaliasedSpecifier = (sourcePath: string, withoutExtension: string): string => {
    const { baseUrl } = readProjectTsconfig();
    if (baseUrl !== undefined) {
        const fromBaseUrl = relative(baseUrl, withoutExtension);
        const topDirectory = fromBaseUrl.split(sep)[0];
        if (readBaseUrlDirectories().some((directory) => basename(directory) === topDirectory)) return fromBaseUrl;
    }

    const previewPath = toPreviewPath(sourcePath);
    if (previewPath === undefined) return relative(MOBILE_APP_ROOT, withoutExtension);

    const fromDeclaration = relative(dirname(previewPath), withoutExtension);
    return fromDeclaration.startsWith('.') ? fromDeclaration : `./${fromDeclaration}`;
};

const findComponent = (file: SourceFile): { name: string } | undefined => {
    const expected = basename(file.getFilePath()).replace(/\.tsx?$/, '');
    const exported = [...file.getExportedDeclarations().keys()].filter(isPascalCase);

    const name = exported.find((candidate) => candidate === expected) ?? exported[0];
    return name === undefined ? undefined : { name };
};

/**
 * The props type a component takes.
 *
 * The shape of the declaration is not examined. It may be wrapped in `React.memo` or `forwardRef`,
 * or be a function declaration, or an arrow function; either way it is a callable value whose first
 * argument is props.
 */
const findPropsType = (file: SourceFile, componentName: string): Type | undefined => {
    const declaration = file.getExportedDeclarations().get(componentName)?.[0];
    if (declaration === undefined) return undefined;

    const signature = declaration.getType().getCallSignatures()[0];
    return signature?.getParameters()[0]?.getTypeAtLocation(declaration);
};

/** Finds an options-building call such as `subscriptionQueries.get()`. */
const findOptionsCall = (node: Node): Node | undefined =>
    node
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .find((call) => Node.isPropertyAccessExpression(call.getExpression()));

const findQueries = (file: SourceFile): QueryUsage[] => {
    const calls = file
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .filter((call) => call.getExpression().getText() === 'useQuery');

    const usages = calls.flatMap((call) => {
        const argument = call.getArguments()[0];
        if (argument === undefined) return [];

        const optionsCall = findOptionsCall(argument) ?? argument;
        const expression = optionsCall.getText();
        const rootName = expression.split('.')[0]?.replace(/\W.*$/, '') ?? '';

        const importDeclaration = file
            .getImportDeclarations()
            .find((declaration) => declaration.getNamedImports().some((named) => named.getName() === rootName));
        if (importDeclaration === undefined) return [];

        // `data` is `T | undefined`. Left as a union, only the shared properties survive and nothing shows.
        const dataType = call.getType().getProperty('data')?.getTypeAtLocation(call).getNonNullableType();

        return [
            {
                expression,
                importFrom: importDeclaration.getModuleSpecifierValue(),
                rootName,
                dataType,
            },
        ];
    });

    return usages;
};

const importsAnyOf = (file: SourceFile, modules: string[]): boolean =>
    file.getImportDeclarations().some((declaration) => modules.includes(declaration.getModuleSpecifierValue()));

/** Component -> hook -> the hook that hook calls. Queries sit about this deep. */
const MAX_HOOK_DEPTH = 2;

const isProjectFile = (file: SourceFile): boolean => {
    const path = file.getFilePath();
    return path.startsWith(`${MOBILE_APP_ROOT}/`) && !path.includes('/node_modules/');
};

/** The files declaring the `use...` hooks this file calls. */
const hookSources = (file: SourceFile): SourceFile[] => {
    const called = new Set(
        file
            .getDescendantsOfKind(SyntaxKind.CallExpression)
            .map((call) => call.getExpression().getText())
            .filter((name) => /^use[A-Z]/.test(name)),
    );

    return file.getImportDeclarations().flatMap((declaration) => {
        if (!declaration.getNamedImports().some((named) => called.has(named.getName()))) return [];

        const source = declaration.getModuleSpecifierSourceFile();
        return source !== undefined && isProjectFile(source) ? [source] : [];
    });
};

/**
 * The files on the path by which a component obtains data.
 *
 * Codebases commonly wrap `useQuery` in a `use{Name}Query` hook rather than calling it directly
 * from the screen. Looking at the component file alone shows only that one hook call, so **it reads
 * as though there is no query.** The draft then comes out without `mockQueries`, and a component
 * that returns `null` without data becomes an empty preview.
 */
const reachableFiles = (entry: SourceFile): SourceFile[] => {
    const seen = new Map<string, SourceFile>([[entry.getFilePath(), entry]]);
    let frontier = [entry];

    for (let depth = 0; depth < MAX_HOOK_DEPTH && frontier.length > 0; depth += 1) {
        frontier = frontier.flatMap(hookSources).filter((source) => {
            if (seen.has(source.getFilePath())) return false;

            seen.set(source.getFilePath(), source);
            return true;
        });
    }

    return [...seen.values()];
};

/**
 * Collects what has to be read from the source in order to write a declaration draft.
 *
 * Type resolution is needed, so this runs on top of the target project's tsconfig. Loading every
 * file in that tsconfig is slow on a large repository, so only this file is loaded and the rest is
 * followed as needed.
 */
export const analyzeComponent = (sourcePath: string): ComponentAnalysis | undefined => {
    const project = new Project({
        tsConfigFilePath: `${MOBILE_APP_ROOT}/tsconfig.json`,
        skipAddingFilesFromTsConfig: true,
    });

    const file = project.addSourceFileAtPath(sourcePath);
    const component = findComponent(file);
    if (component === undefined) return undefined;

    const files = reachableFiles(file);
    // Two hooks sometimes call the same query. It is written into the declaration only once.
    const queries = [...new Map(files.flatMap(findQueries).map((usage) => [usage.expression, usage])).values()];

    return {
        name: component.name,
        importSpecifier: toAliasSpecifier(sourcePath),
        propsType: findPropsType(file, component.name),
        queries,
        usesNavigation: files.some((source) => importsAnyOf(source, ['@react-navigation/native'])),
        usesSafeArea: true,
    };
};
