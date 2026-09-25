#!/usr/bin/env python3
"""Validate data/*.json against the schemas in data/schema/.

    python .github/scripts/validate_data.py                  # every file with a schema
    python .github/scripts/validate_data.py data/books.json  # just these

A schema is data/schema/<name>.schema.json and validates data/<name>.json,
so adding a schema is all it takes to put a file under validation. Exit
status: 0 when every file matches, 1 when any does not (each problem is
printed with its path, like `books.json[12].d`), 2 when a file or its
schema is missing or a schema uses a keyword this validator does not
enforce.

Why it exists. The weekly live-data workflow rewrites six files that the
homepage, the Now strip, the music crate and the reading pages parse in
the browser with no fallback for a wrong shape. A fetch that half
succeeds, or an upstream API that changes a field, would otherwise be
committed and served until someone noticed a blank panel. The workflow
runs this before it commits, and site-checks runs it on every push, so a
hand edit is held to the same shape. posts.json (typed in, with fields
the post generators add) and publications.json (typed in) have schemas
for the same reason: every listing and the publications list read them
with no fallback either.

Why not the jsonschema package. CI's audit job installs nothing, and the
schemas need only a small part of JSON Schema. This implements that part
exactly as the specification defines it, so the schema files stay valid
JSON Schema (draft 2020-12) that any other validator would read the same
way:

    type                  a name or a list of names; "integer" excludes
                          true/false, which Python counts as integers
    properties, required, additionalProperties (true or false only)
    items                 one schema, applied to every element
    enum, minimum, maximum, pattern (re.search, as the spec says, so
                          anchor with ^ and $)
    $schema, $id, title, description   annotations, not checked

Any other keyword is refused with exit status 2 rather than ignored: a
schema that looks stricter than it is would be worse than none.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402

ROOT = sitelib.ROOT
DATA = ROOT / "data"
SCHEMAS = DATA / "schema"

ANNOTATIONS = {"$schema", "$id", "title", "description"}
ENFORCED = {"type", "properties", "required", "additionalProperties", "items",
            "enum", "minimum", "maximum", "pattern"}

TYPES = {
    "object": lambda v: isinstance(v, dict),
    "array": lambda v: isinstance(v, list),
    "string": lambda v: isinstance(v, str),
    "integer": lambda v: isinstance(v, int) and not isinstance(v, bool),
    "number": lambda v: isinstance(v, (int, float)) and not isinstance(v, bool),
    "boolean": lambda v: isinstance(v, bool),
    "null": lambda v: v is None,
}

# Enough to find the fault without drowning the log when a whole array
# is the wrong shape.
MAX_ERRORS = 25


class SchemaError(Exception):
    """The schema itself asks for something this validator cannot do."""


def check_schema(schema: dict, where: str = "#") -> None:
    """Refuse keywords outside the enforced subset, recursively."""
    if not isinstance(schema, dict):
        raise SchemaError("%s: a schema must be an object" % where)
    unknown = set(schema) - ENFORCED - ANNOTATIONS
    if unknown:
        raise SchemaError("%s: unsupported keyword(s) %s" % (where, ", ".join(sorted(unknown))))
    ap = schema.get("additionalProperties", True)
    if not isinstance(ap, bool):
        raise SchemaError("%s: additionalProperties must be true or false here" % where)
    for name, sub in (schema.get("properties") or {}).items():
        check_schema(sub, "%s/properties/%s" % (where, name))
    if "items" in schema:
        check_schema(schema["items"], where + "/items")
    for t in ([schema["type"]] if isinstance(schema.get("type"), str) else schema.get("type", [])):
        if t not in TYPES:
            raise SchemaError("%s: unknown type %r" % (where, t))


def validate(value, schema: dict, path: str, errors: list[str]) -> None:
    """Append a message to `errors` for every way `value` breaks `schema`."""
    if "type" in schema:
        names = [schema["type"]] if isinstance(schema["type"], str) else schema["type"]
        if not any(TYPES[n](value) for n in names):
            errors.append("%s: expected %s, got %s" % (path, " or ".join(names), _describe(value)))
            return  # the other keywords would only repeat the complaint
    if "enum" in schema and value not in schema["enum"]:
        errors.append("%s: %r is not one of %r" % (path, value, schema["enum"]))
    if TYPES["number"](value):
        if "minimum" in schema and value < schema["minimum"]:
            errors.append("%s: %r is below the minimum %r" % (path, value, schema["minimum"]))
        if "maximum" in schema and value > schema["maximum"]:
            errors.append("%s: %r is above the maximum %r" % (path, value, schema["maximum"]))
    if isinstance(value, str) and "pattern" in schema:
        if not re.search(schema["pattern"], value):
            errors.append("%s: %r does not match %s" % (path, value, schema["pattern"]))
    if isinstance(value, dict):
        props = schema.get("properties") or {}
        for key in schema.get("required") or []:
            if key not in value:
                errors.append("%s: missing required field %r" % (path, key))
        for key, item in value.items():
            if key in props:
                validate(item, props[key], "%s.%s" % (path, key), errors)
            elif schema.get("additionalProperties", True) is False:
                errors.append("%s: unexpected field %r" % (path, key))
    if isinstance(value, list) and "items" in schema:
        for i, item in enumerate(value):
            validate(item, schema["items"], "%s[%d]" % (path, i), errors)


def _describe(value) -> str:
    for name in ("null", "boolean", "integer", "number", "string", "array", "object"):
        if TYPES[name](value):
            return name
    return type(value).__name__


def schema_for(data_file: Path) -> Path:
    return SCHEMAS / (data_file.stem + ".schema.json")


def validate_file(data_file: Path) -> list[str]:
    """Problems with one data file, as printable lines (empty when valid).

    Raises SchemaError for a missing or unusable schema, FileNotFoundError
    for a missing data file.
    """
    schema_path = schema_for(data_file)
    if not schema_path.exists():
        raise SchemaError("no schema at %s" % schema_path.relative_to(ROOT).as_posix())
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    check_schema(schema)
    try:
        value = json.loads(data_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        return ["%s: not valid JSON (%s)" % (data_file.name, e)]
    errors: list[str] = []
    validate(value, schema, data_file.name, errors)
    return errors


def main(argv: list[str] | None = None) -> int:
    ap = sitelib.arg_parser(__doc__)
    ap.add_argument("files", nargs="*", type=Path,
                    help="data files to validate (default: every one with a schema)")
    args = ap.parse_args(argv)

    files = [f if f.is_absolute() else (Path.cwd() / f) for f in args.files]
    if not files:
        files = [DATA / s.name.replace(".schema.json", ".json")
                 for s in sorted(SCHEMAS.glob("*.schema.json"))]
    if not files:
        print("no schemas in %s" % SCHEMAS.relative_to(ROOT).as_posix())
        return 2

    status = 0
    for f in files:
        try:
            errors = validate_file(f.resolve())
        except (SchemaError, FileNotFoundError, json.JSONDecodeError) as e:
            print("%s: cannot validate: %s" % (f.name, e))
            status = 2
            continue
        if errors:
            status = max(status, 1)
            print("%s: %d problem%s" % (f.name, len(errors), "" if len(errors) == 1 else "s"))
            for line in errors[:MAX_ERRORS]:
                print("  " + line)
            if len(errors) > MAX_ERRORS:
                print("  ... and %d more" % (len(errors) - MAX_ERRORS))
        else:
            print("%s: matches %s" % (f.name, schema_for(f).name))
    return status


if __name__ == "__main__":
    sys.exit(main())
