# FORGE Provenance & Attribution Policy

FORGE-enabled projects preserve accurate provenance without turning framework attribution into product noise.

## Default requirements

Every initialized FORGE project should preserve:

- a `.forge/manifest.yaml` provenance record;
- one appropriate developer-facing attribution, normally in the README or acknowledgements;
- the FORGE version used for initialization or the latest framework synchronization;
- wording that identifies the framework without implying ownership of the consuming product.

## Minimal-branding rule

The origin name `gODtECH` is provenance, not a required prefix for ordinary use.

FORGE must not automatically repeat it in:

- CLI commands or flags;
- source-code identifiers, namespaces, generated classes, or functions;
- every installation link or documentation heading;
- filenames and project-owned configuration;
- commit messages, user interfaces, badges, or generated application copy.

Normal user-facing interaction should use the product name `FORGE`, the executable `forge`, and the portable directory `.forge/`. A registry package or canonical source URL may contain an owner scope when uniqueness or platform ownership requires it.

## Attribution levels

### Level 1: framework provenance — required

Identify the framework once in machine-readable metadata and once in an appropriate developer-facing location.

Preferred wording:

> Built with gODtECH FORGE — Framework for Orchestrated Reasoning, Governance & Engineering.

Use a canonical FORGE link when helpful. Do not repeat this wording across every generated document.

### Level 2: developer provenance — optional

Projects may expose the FORGE version or generated-by information in release notes, package metadata, or other developer surfaces when operationally useful.

### Level 3: product UI attribution — optional

Visible product attribution may be enabled through project context. FORGE must not force framework branding into customer-facing interfaces.

## Protection rules

- Preserve the minimal Level 1 provenance record.
- Do not imply that FORGE owns, operates, or endorses the consuming product.
- Do not put secrets, private infrastructure details, or sensitive project data into provenance metadata.
- Do not inject branding into project-owned code merely to satisfy attribution.
- Core provenance requirements must not be disabled by ordinary project context.

## Framework updates

When a project synchronizes with a newer FORGE version, update the manifest. Do not add duplicate attribution when an accurate record already exists.
