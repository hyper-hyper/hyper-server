#!/usr/bin/env bun

import { parseArgs } from "util";

const { values, positionals } = parseArgs({
  args: Bun.argv,
  allowPositionals: true,
  options: {
    major: {
      type: "boolean",
      short: "M"
    },
    minor: {
      type: "boolean",
      short: "m"
    },
    patch: {
      type: "boolean",
      short: "p"
    },
    adjust: {
      type: "string",
      short: "a"
    }
  }
});

// Get the last positional argument (should be package.json)
const [ path ] = positionals.slice(-1);

// Check if the path is a package.json
if(path.indexOf("package.json") === -1) {
  console.log("Looks like the path is not a package.json");
  process.exit();
}

// Read the package.json file and parse it
const file = Bun.file(path);
const pkg = await file.json();
const [ major, minor, patch ] = pkg.version.split(".");

// Log the retrieved values for debugging
console.log(major, minor, patch, values);

// Modify the version based on the flags
if(values.adjust) {
  console.log(`Adjusting version manually to: ${values.adjust}`);
  pkg.version = values.adjust;
}
else if(values.major) {
  pkg.version = `${Number(major) + 1}.0.0`;
}
else if(values.minor) {
  pkg.version = `${major}.${Number(minor) + 1}.0`;
}
else if(values.patch) {
  pkg.version = `${major}.${minor}.${Number(patch) + 1}`;
}
else {
  console.log("No valid flag specified!");
  process.exit();
}

// Write the updated package.json back to the file
Bun.write(file, JSON.stringify(pkg, null, 2));
console.log(`Version updated to ${pkg.version}`);
