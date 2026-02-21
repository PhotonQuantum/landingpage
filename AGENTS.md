= Cleaning Build Artifacts

Clean these folders to avoid stale artifacts. This is especially important when switching branches or making significant changes to the codebase, as it ensures that old build artifacts do not interfere with the new build process.

```bash
rm -rf .output .vinxi .wrangler node_modules/.vinxi node_modules/.cache node_modules/.vinxi
```