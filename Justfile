# Justfile for @nullstyle/ase-format

# Default recipe
default: check test

# Type check
check:
    deno check mod.ts

# Run all tests
test:
    deno test -A

# Lint code
lint:
    deno lint

# Format code
fmt:
    deno fmt

# Check formatting
fmt-check:
    deno fmt --check

# Lint documentation
doc-lint:
    deno doc --lint mod.ts

# Generate HTML documentation
doc-html:
    deno doc --html mod.ts

# Run all checks (lint, format, type check, test)
ci: lint fmt-check check test doc-lint

# Publish to JSR (dry run)
publish-dry:
    deno publish --dry-run

# Publish to JSR
publish:
    deno publish
