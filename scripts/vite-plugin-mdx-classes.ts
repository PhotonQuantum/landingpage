import type { Plugin, ViteDevServer } from 'vite';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default function mdxClassesPlugin(): Plugin {
  return {
    name: 'vite-plugin-mdx-classes',
    configureServer(server: ViteDevServer) {
      // Watch for changes in MDX files
      server.watcher.add('src/routes/**/*.mdx');
      
      // Run the script when MDX files change
      server.watcher.on('change', async (path: string) => {
        if (path.endsWith('.mdx')) {
          try {
            await execAsync('pnpx tsx scripts/generate-mdx-classes.ts');
            console.log('Updated MDX inline styles');
          } catch (error) {
            console.error('Failed to update MDX inline styles:', error);
          }
        }
      });
    }
  };
} 