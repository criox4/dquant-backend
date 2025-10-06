import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/**/*.ts'],
  format: ['cjs'],
  target: 'node18',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  minify: false,
  splitting: false,
  dts: false,
  external: [
    '@prisma/client',
    'redis',
    'fastify',
    'winston'
  ],
  noExternal: [],
  treeshake: true,
  platform: 'node',
  esbuildOptions(options) {
    options.conditions = ['node'];
  }
});