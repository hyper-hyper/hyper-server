import { parseArgs } from "util";

/**
 * Get Public IP
 */
export const getPublicIP = async () => {
  return await fetch("https://api.ipify.org")
    .then( response => response.text() )
    .then( ip => ip.trim() );
};

/**
 * 
 * @param {String} semver 
 * @param {String} path 
 * @returns 
 */
export const updateVersion = async (semver, path) => {
  // Resolve the absolute path to the package.json file
  const packageFilePath = path.resolve(packagePath);

  // Read and parse the package.json file
  let packageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(packageFilePath, 'utf-8'));
  } catch (err) {
    console.error(`Error reading package.json at ${packageFilePath}: ${err.message}`);
    return;
  }

  // Parse the current version from package.json
  let [major, minor, patch] = (packageJson.version || '0.0.0').split('.').map(Number);

  // If semver is in shorthand format (e.g., "-1", "-1.0", etc.), adjust accordingly
  if (/^[-+]\d+(\.\d+)?(\.\d+)?$/.test(semver)) {
    const [majorOffset = 0, minorOffset = 0, patchOffset = 0] = semver.split('.').map(Number);
    major += majorOffset;
    minor += minorOffset;
    patch += patchOffset;
  } else {
    // Parse the provided semver string if it's a valid semantic version (like 1.0.1)
    try {
      [major, minor, patch] = semver.split('.').map(Number);
    } catch (err) {
      console.error(`Invalid semver format: ${semver}`);
      return;
    }
  }

  // Ensure no negative version numbers
  if (major < 0 || minor < 0 || patch < 0) {
    console.error('Version numbers cannot be negative.');
    return;
  }

  // Update the package.json with the new version
  const newVersion = `${major}.${minor}.${patch}`;
  packageJson.version = newVersion;

  // Write the updated package.json back to the file
  try {
    fs.writeFileSync(packageFilePath, JSON.stringify(packageJson, null, 2), 'utf-8');
    console.log(`Version updated to ${newVersion} in ${packageFilePath}`);
  } catch (err) {
    console.error(`Error writing to package.json: ${err.message}`);
  }
};


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

const [ path ] = positionals.slice(-1);

if(path.indexOf("package.json") === -1) {
  console.log("Looks like the path is not a package.json");
  process.exit();
}

const file = Bun.file(path);
const pkg = await file.json();
const [ major, minor, patch ] = pkg.version.split(".");

console.log(major, minor, patch, values,);

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

Bun.write(file, JSON.stringify(pkg, null, 2));
console.log(`Version updated to ${pkg.version}`);
