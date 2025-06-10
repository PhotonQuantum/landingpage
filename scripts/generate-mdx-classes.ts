import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import glob from 'fast-glob';
import lockfile from 'proper-lockfile';

const MDX_DIR = 'src/routes';
const CSS_FILE = 'src/app.css';

async function extractClassesFromMDX(content: string): Promise<Set<string>> {
  const classes = new Set<string>();
  
  // Match patterns like :span[text]{.class1 .class2} but not JSX comments
  const regex = /:[a-zA-Z]+\[[^\]]+\]{\.([^}]+)}/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const classString = match[1];
    // Split by spaces and add each class
    classString.split(/\s+/).forEach(cls => {
      if (cls) classes.add(cls.replace(/^\./, ''));
    });
  }
  
  return classes;
}

async function updateCSSFile(classes: Set<string>): Promise<void> {
  // Acquire lock before reading/writing
  const release = await lockfile.lock(CSS_FILE, {
    retries: {
      retries: 5,
      factor: 3,
      minTimeout: 100,
      maxTimeout: 1000,
      randomize: true,
    }
  });

  try {
    const cssContent = await readFile(CSS_FILE, 'utf-8');
    
    // Create the new inline styles string
    const inlineStyles = Array.from(classes).join(' ');
    
    // Replace the content between the codegen markers
    const updatedContent = cssContent.replace(
      /\/\* @@ CODEGEN: BEGIN MDX INLINE STYLES @@ \*\/\n@source inline\(".*"\);\n\/\* @@ CODEGEN: END MDX INLINE STYLES @@ \*\//,
      `/* @@ CODEGEN: BEGIN MDX INLINE STYLES @@ */\n@source inline("${inlineStyles}");\n/* @@ CODEGEN: END MDX INLINE STYLES @@ */`
    );
    
    await writeFile(CSS_FILE, updatedContent);
  } finally {
    // Always release the lock, even if there's an error
    await release();
  }
}

async function main(): Promise<void> {
  try {
    // Find all MDX files
    const mdxFiles = await glob('**/*.mdx', { cwd: MDX_DIR });
    
    // Collect all unique classes
    const allClasses = new Set<string>();
    
    for (const file of mdxFiles) {
      const content = await readFile(join(MDX_DIR, file), 'utf-8');
      const fileClasses = await extractClassesFromMDX(content);
      fileClasses.forEach(cls => allClasses.add(cls));
    }
    
    // Update the CSS file
    await updateCSSFile(allClasses);
    
    console.log('Successfully updated MDX inline styles in app.css');
    console.log('Found classes:', Array.from(allClasses).join(', '));
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
