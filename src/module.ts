import { createHash, Hash } from "crypto";

import { Builder } from "./builder";
import { EImportKind, Import } from "./import";
import { IContext, NamedRenderer, TRenderer } from "./renderer";

const headerTemplateWithoutBespoke: string = `/**
 * This file is fully generated; do not manually edit.
 *
 * SOURCE<<@0>>
 * SIGNED<<@1>>
 */`;

const headerTemplateWithBespoke: string = `/**
 * This file is partially generated; only edit bespoke sections.
 *
 * SOURCE<<@0>>
 * BESPOKE<<@1>>
 * SIGNED<<@2>>
 */`;

export interface IModule {
  readonly content: TRenderer[];
  readonly destination: string;
}

export class Module extends NamedRenderer {

  public static new(props: IModule): Module {
    return new Module(props);
  }

  private static getHash(builder: Builder): string {
    const hash: Hash = createHash("SHA512");
    hash.update(builder.print());

    return hash.digest("base64");
  }

  private static renderImports(
    context: IContext,
    builder: Builder,
    imports: Import[],
  ): void {
    Module.renderImportSection(
      context,
      builder,
      imports
        .filter(
          (i: Import): boolean => i.kind() === EImportKind.RAW,
        ),
    );
    builder.ensureOnNewlineAfterEmptyline();
    Module.renderImportSection(
      context,
      builder,
      imports
        .filter(
          (i: Import): boolean => i.kind() === EImportKind.GLOBAL,
        ),
    );
    builder.ensureOnNewlineAfterEmptyline();
    Module.renderImportSection(
      context,
      builder,
      imports
        .filter(
          (i: Import): boolean => i.kind() === EImportKind.LOCAL,
        ),
    );
    builder.ensureOnNewlineAfterEmptyline();
  }

  private static renderImportSection(
    context: IContext,
    builder: Builder,
    imports: Import[],
  ): void {
    imports.forEach(
      (i: Import) => {
        i.run(context, builder);
      },
    );
  }

  private static renderNonImports(
    context: IContext,
    builder: Builder,
    nonImports: TRenderer[],
  ): void {
    nonImports
      .forEach(
        (r: TRenderer): void => {
          builder.ensureOnNewlineAfterEmptyline();
          Module.genericRenderer(r)(context, builder);
        },
      );
  }

  private constructor(
    private readonly props: IModule,
  ) {
    super();
  }

  public bespokes(): string[] {
    return [...Module.genericBespokes(this.props.content)];
  }

  public destination(): string {
    return this.props.destination;
  }

  public identifiers(): string[] {
    return [...Module.genericIdentifiers(this.props.content)];
  }

  protected render(
    context: IContext,
    builder: Builder,
  ): void {
    const imports: Import[] = this.props.content
      .filter(
        (i: TRenderer): i is Import => i instanceof Import,
      )
      .sort(
        (a: Import, b: Import) => a.identifiers()[0]
          .localeCompare(b.identifiers()[0]),
      );
    Module.renderImports(context, builder, imports);

    const nonImports: TRenderer[] = this.props.content
      .filter(
        (i: TRenderer): boolean => !(i instanceof Import),
      );
    Module.renderNonImports(context, builder, nonImports);

    const bespokes: string[] = this.bespokes();
    let header: string = "";
    if (bespokes.length > 0) {
      header = headerTemplateWithBespoke
        .replace("@0", `${context.path}::${context.name}`)
        .replace("@1", bespokes.join(", "))
        .replace("@2", Module.getHash(builder));
    } else {
      header = headerTemplateWithoutBespoke
        .replace("@0", `${context.path}::${context.name}`)
        .replace("@1", Module.getHash(builder));
    }
    builder.setHeader(header);
  }

  protected verify(context: IContext): void {
    this.verifyUniqueBespoke();
    this.verifyUniqueIdentifiers();
  }

  private verifyUniqueBespoke(): void {
    const bespokeArray: string[] = this.bespokes();
    const bespokeSet: Set<string> = new Set(bespokeArray);
    if (bespokeSet.size < bespokeArray.length) {
      throw new Error("Duplicated Bespoke Sections");
    }
  }

  private verifyUniqueIdentifiers(): void {
    const identifierArray: string[] = this.identifiers();
    const identifierSet: Set<string> = new Set(identifierArray);
    if (identifierSet.size < identifierArray.length) {
      throw new Error("Duplicated Identifier Names");
    }
  }
}
