// vite.config.js
import { APP_SHARED_DEPS } from "file:///home/sondre/projects/knew/directus/packages/extensions/dist/index.js";
import { generateExtensionsEntrypoint, resolveFsExtensions, resolveModuleExtensions } from "file:///home/sondre/projects/knew/directus/packages/extensions/dist/node.js";
import yaml from "file:///home/sondre/projects/knew/directus/node_modules/.pnpm/@rollup+plugin-yaml@4.1.2_rollup@4.30.1/node_modules/@rollup/plugin-yaml/dist/es/index.js";
import UnheadVite from "file:///home/sondre/projects/knew/directus/node_modules/.pnpm/@unhead+addons@1.11.15_rollup@4.30.1/node_modules/@unhead/addons/dist/vite.mjs";
import vue from "file:///home/sondre/projects/knew/directus/node_modules/.pnpm/@vitejs+plugin-vue@5.2.1_vite@5.4.11_@types+node@22.10.5_sass-embedded@1.83.1_terser@5.39.0___afv2mciohulhgbydla4vfiwvga/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import fs from "node:fs";
import path from "node:path";
import { searchForWorkspaceRoot } from "file:///home/sondre/projects/knew/directus/node_modules/.pnpm/vite@5.4.11_@types+node@22.10.5_sass-embedded@1.83.1_terser@5.39.0/node_modules/vite/dist/node/index.js";
import { defineConfig } from "file:///home/sondre/projects/knew/directus/node_modules/.pnpm/vitest@2.1.8_@types+node@22.10.5_happy-dom@16.5.3_jsdom@20.0.3_sass-embedded@1.83.1_terser@5.39.0/node_modules/vitest/dist/config.js";
import vueDevtools from "file:///home/sondre/projects/knew/directus/node_modules/.pnpm/vite-plugin-vue-devtools@7.7.0_rollup@4.30.1_vite@5.4.11_@types+node@22.10.5_sass-embedded@1._gec3clwz7fcjsp5ad7zqfr3xfa/node_modules/vite-plugin-vue-devtools/dist/vite.mjs";
var __vite_injected_original_dirname = "/home/sondre/projects/knew/directus/app";
var API_PATH = path.join("..", "api");
var EXTENSIONS_PATH = path.join(API_PATH, "extensions");
var extensionsPathExists = fs.existsSync(EXTENSIONS_PATH);
var vite_config_default = defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        api: "modern-compiler"
      }
    }
  },
  plugins: [
    directusExtensions(),
    vue(),
    UnheadVite(),
    yaml({
      transform(data) {
        return data === null ? {} : void 0;
      }
    }),
    {
      name: "watch-directus-dependencies",
      configureServer: (server) => {
        server.watcher.options = {
          ...server.watcher.options,
          ignored: [/node_modules\/(?!@directus\/).*/, "**/.git/**"]
        };
      }
    },
    vueDevtools()
  ],
  define: {
    __VUE_I18N_LEGACY_API__: false
  },
  resolve: {
    alias: [{ find: "@", replacement: path.resolve(__vite_injected_original_dirname, "src") }]
  },
  base: process.env.NODE_ENV === "production" ? "" : "/admin",
  ...!process.env.HISTOIRE && {
    server: {
      port: 8080,
      proxy: {
        "^/(?!admin)": {
          target: process.env.API_URL ? process.env.API_URL : "http://127.0.0.1:8055/",
          changeOrigin: true
        },
        "/websocket/logs": {
          target: process.env.API_URL ? process.env.API_URL : "ws://127.0.0.1:8055/",
          changeOrigin: true
        }
      },
      fs: {
        allow: [searchForWorkspaceRoot(process.cwd()), ...getExtensionsRealPaths()]
      }
    }
  },
  test: {
    environment: "happy-dom",
    deps: {
      optimizer: {
        web: {
          exclude: ["pinia", "url"]
        }
      }
    }
  }
});
function getExtensionsRealPaths() {
  return extensionsPathExists ? fs.readdirSync(EXTENSIONS_PATH).flatMap((typeDir) => {
    const extensionTypeDir = path.join(EXTENSIONS_PATH, typeDir);
    if (!fs.statSync(extensionTypeDir).isDirectory()) return;
    return fs.readdirSync(extensionTypeDir).map((dir) => fs.realpathSync(path.join(extensionTypeDir, dir)));
  }).filter((v) => v) : [];
}
function directusExtensions() {
  const virtualExtensionsId = "@directus-extensions";
  let extensionsEntrypoint = null;
  return [
    {
      name: "directus-extensions-serve",
      apply: "serve",
      config: () => ({
        optimizeDeps: {
          include: APP_SHARED_DEPS
        }
      }),
      async buildStart() {
        await loadExtensions();
      },
      resolveId(id) {
        if (id === virtualExtensionsId) {
          return id;
        }
      },
      load(id) {
        if (id === virtualExtensionsId) {
          return extensionsEntrypoint;
        }
      }
    },
    {
      name: "directus-extensions-build",
      apply: "build",
      config: () => ({
        build: {
          rollupOptions: {
            input: {
              index: path.resolve(__vite_injected_original_dirname, "index.html"),
              ...APP_SHARED_DEPS.reduce((acc, dep) => ({ ...acc, [dep.replace(/\//g, "_")]: dep }), {})
            },
            output: {
              entryFileNames: "assets/[name].[hash].entry.js"
            },
            external: [virtualExtensionsId],
            preserveEntrySignatures: "exports-only"
          }
        }
      })
    }
  ];
  async function loadExtensions() {
    const localExtensions = extensionsPathExists ? await resolveFsExtensions(EXTENSIONS_PATH) : /* @__PURE__ */ new Map();
    const moduleExtensions = await resolveModuleExtensions(API_PATH);
    const registryExtensions = extensionsPathExists ? await resolveFsExtensions(path.join(EXTENSIONS_PATH, ".registry")) : /* @__PURE__ */ new Map();
    const mockSetting = (source, folder, extension) => {
      const settings = [
        {
          id: extension.name,
          enabled: true,
          folder,
          bundle: null,
          source
        }
      ];
      if (extension.type === "bundle") {
        settings.push(
          ...extension.entries.map((entry) => ({
            enabled: true,
            folder: entry.name,
            bundle: extension.name,
            source
          }))
        );
      }
      return settings;
    };
    const extensionSettings = [
      ...Array.from(localExtensions.entries()).flatMap(
        ([folder, extension]) => mockSetting("local", folder, extension)
      ),
      ...Array.from(moduleExtensions.entries()).flatMap(
        ([folder, extension]) => mockSetting("module", folder, extension)
      ),
      ...Array.from(registryExtensions.entries()).flatMap(
        ([folder, extension]) => mockSetting("registry", folder, extension)
      )
    ];
    extensionsEntrypoint = generateExtensionsEntrypoint(
      { module: moduleExtensions, local: localExtensions, registry: registryExtensions },
      extensionSettings
    );
  }
}
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9zb25kcmUvcHJvamVjdHMva25ldy9kaXJlY3R1cy9hcHBcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9ob21lL3NvbmRyZS9wcm9qZWN0cy9rbmV3L2RpcmVjdHVzL2FwcC92aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vaG9tZS9zb25kcmUvcHJvamVjdHMva25ldy9kaXJlY3R1cy9hcHAvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBBUFBfU0hBUkVEX0RFUFMgfSBmcm9tICdAZGlyZWN0dXMvZXh0ZW5zaW9ucyc7XG5pbXBvcnQgeyBnZW5lcmF0ZUV4dGVuc2lvbnNFbnRyeXBvaW50LCByZXNvbHZlRnNFeHRlbnNpb25zLCByZXNvbHZlTW9kdWxlRXh0ZW5zaW9ucyB9IGZyb20gJ0BkaXJlY3R1cy9leHRlbnNpb25zL25vZGUnO1xuaW1wb3J0IHlhbWwgZnJvbSAnQHJvbGx1cC9wbHVnaW4teWFtbCc7XG5pbXBvcnQgVW5oZWFkVml0ZSBmcm9tICdAdW5oZWFkL2FkZG9ucy92aXRlJztcbmltcG9ydCB2dWUgZnJvbSAnQHZpdGVqcy9wbHVnaW4tdnVlJztcbmltcG9ydCBmcyBmcm9tICdub2RlOmZzJztcbmltcG9ydCBwYXRoIGZyb20gJ25vZGU6cGF0aCc7XG5pbXBvcnQgeyBzZWFyY2hGb3JXb3Jrc3BhY2VSb290IH0gZnJvbSAndml0ZSc7XG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlc3QvY29uZmlnJztcbmltcG9ydCB2dWVEZXZ0b29scyBmcm9tICd2aXRlLXBsdWdpbi12dWUtZGV2dG9vbHMnO1xuXG5jb25zdCBBUElfUEFUSCA9IHBhdGguam9pbignLi4nLCAnYXBpJyk7XG5cbi8qXG4gKiBAVE9ETyBUaGlzIGV4dGVuc2lvbiBwYXRoIGlzIGhhcmRjb2RlZCB0byB0aGUgZW52IGRlZmF1bHQgKC4vZXh0ZW5zaW9ucykuIFRoaXMgd29uJ3Qgd29ya1xuICogYXMgZXhwZWN0ZWQgd2hlbiBleHRlbnNpb25zIGFyZSByZWFkIGZyb20gYSBkaWZmZXJlbnQgbG9jYXRpb24gbG9jYWxseSB0aHJvdWdoIHRoZVxuICogRVhURU5TSU9OU19MT0NBVElPTiBlbnYgdmFyXG4gKi9cbmNvbnN0IEVYVEVOU0lPTlNfUEFUSCA9IHBhdGguam9pbihBUElfUEFUSCwgJ2V4dGVuc2lvbnMnKTtcblxuY29uc3QgZXh0ZW5zaW9uc1BhdGhFeGlzdHMgPSBmcy5leGlzdHNTeW5jKEVYVEVOU0lPTlNfUEFUSCk7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuXHRjc3M6IHtcblx0XHRwcmVwcm9jZXNzb3JPcHRpb25zOiB7XG5cdFx0XHRzY3NzOiB7XG5cdFx0XHRcdGFwaTogJ21vZGVybi1jb21waWxlcicsXG5cdFx0XHR9LFxuXHRcdH0sXG5cdH0sXG5cdHBsdWdpbnM6IFtcblx0XHRkaXJlY3R1c0V4dGVuc2lvbnMoKSxcblx0XHR2dWUoKSxcblx0XHRVbmhlYWRWaXRlKCksXG5cdFx0eWFtbCh7XG5cdFx0XHR0cmFuc2Zvcm0oZGF0YSkge1xuXHRcdFx0XHRyZXR1cm4gZGF0YSA9PT0gbnVsbCA/IHt9IDogdW5kZWZpbmVkO1xuXHRcdFx0fSxcblx0XHR9KSxcblx0XHR7XG5cdFx0XHRuYW1lOiAnd2F0Y2gtZGlyZWN0dXMtZGVwZW5kZW5jaWVzJyxcblx0XHRcdGNvbmZpZ3VyZVNlcnZlcjogKHNlcnZlcikgPT4ge1xuXHRcdFx0XHRzZXJ2ZXIud2F0Y2hlci5vcHRpb25zID0ge1xuXHRcdFx0XHRcdC4uLnNlcnZlci53YXRjaGVyLm9wdGlvbnMsXG5cdFx0XHRcdFx0aWdub3JlZDogWy9ub2RlX21vZHVsZXNcXC8oPyFAZGlyZWN0dXNcXC8pLiovLCAnKiovLmdpdC8qKiddLFxuXHRcdFx0XHR9O1xuXHRcdFx0fSxcblx0XHR9LFxuXHRcdHZ1ZURldnRvb2xzKCksXG5cdF0sXG5cdGRlZmluZToge1xuXHRcdF9fVlVFX0kxOE5fTEVHQUNZX0FQSV9fOiBmYWxzZSxcblx0fSxcblx0cmVzb2x2ZToge1xuXHRcdGFsaWFzOiBbeyBmaW5kOiAnQCcsIHJlcGxhY2VtZW50OiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnc3JjJykgfV0sXG5cdH0sXG5cdGJhc2U6IHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAncHJvZHVjdGlvbicgPyAnJyA6ICcvYWRtaW4nLFxuXHQuLi4oIXByb2Nlc3MuZW52LkhJU1RPSVJFICYmIHtcblx0XHRzZXJ2ZXI6IHtcblx0XHRcdHBvcnQ6IDgwODAsXG5cdFx0XHRwcm94eToge1xuXHRcdFx0XHQnXi8oPyFhZG1pbiknOiB7XG5cdFx0XHRcdFx0dGFyZ2V0OiBwcm9jZXNzLmVudi5BUElfVVJMID8gcHJvY2Vzcy5lbnYuQVBJX1VSTCA6ICdodHRwOi8vMTI3LjAuMC4xOjgwNTUvJyxcblx0XHRcdFx0XHRjaGFuZ2VPcmlnaW46IHRydWUsXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCcvd2Vic29ja2V0L2xvZ3MnOiB7XG5cdFx0XHRcdFx0dGFyZ2V0OiBwcm9jZXNzLmVudi5BUElfVVJMID8gcHJvY2Vzcy5lbnYuQVBJX1VSTCA6ICd3czovLzEyNy4wLjAuMTo4MDU1LycsXG5cdFx0XHRcdFx0Y2hhbmdlT3JpZ2luOiB0cnVlLFxuXHRcdFx0XHR9LFxuXHRcdFx0fSxcblx0XHRcdGZzOiB7XG5cdFx0XHRcdGFsbG93OiBbc2VhcmNoRm9yV29ya3NwYWNlUm9vdChwcm9jZXNzLmN3ZCgpKSwgLi4uZ2V0RXh0ZW5zaW9uc1JlYWxQYXRocygpXSxcblx0XHRcdH0sXG5cdFx0fSxcblx0fSksXG5cdHRlc3Q6IHtcblx0XHRlbnZpcm9ubWVudDogJ2hhcHB5LWRvbScsXG5cdFx0ZGVwczoge1xuXHRcdFx0b3B0aW1pemVyOiB7XG5cdFx0XHRcdHdlYjoge1xuXHRcdFx0XHRcdGV4Y2x1ZGU6IFsncGluaWEnLCAndXJsJ10sXG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdH0sXG5cdH0sXG59KTtcblxuZnVuY3Rpb24gZ2V0RXh0ZW5zaW9uc1JlYWxQYXRocygpIHtcblx0cmV0dXJuIGV4dGVuc2lvbnNQYXRoRXhpc3RzXG5cdFx0PyBmc1xuXHRcdFx0XHQucmVhZGRpclN5bmMoRVhURU5TSU9OU19QQVRIKVxuXHRcdFx0XHQuZmxhdE1hcCgodHlwZURpcikgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGV4dGVuc2lvblR5cGVEaXIgPSBwYXRoLmpvaW4oRVhURU5TSU9OU19QQVRILCB0eXBlRGlyKTtcblx0XHRcdFx0XHRpZiAoIWZzLnN0YXRTeW5jKGV4dGVuc2lvblR5cGVEaXIpLmlzRGlyZWN0b3J5KCkpIHJldHVybjtcblx0XHRcdFx0XHRyZXR1cm4gZnMucmVhZGRpclN5bmMoZXh0ZW5zaW9uVHlwZURpcikubWFwKChkaXIpID0+IGZzLnJlYWxwYXRoU3luYyhwYXRoLmpvaW4oZXh0ZW5zaW9uVHlwZURpciwgZGlyKSkpO1xuXHRcdFx0XHR9KVxuXHRcdFx0XHQuZmlsdGVyKCh2KSA9PiB2KVxuXHRcdDogW107XG59XG5cbmZ1bmN0aW9uIGRpcmVjdHVzRXh0ZW5zaW9ucygpIHtcblx0Y29uc3QgdmlydHVhbEV4dGVuc2lvbnNJZCA9ICdAZGlyZWN0dXMtZXh0ZW5zaW9ucyc7XG5cblx0bGV0IGV4dGVuc2lvbnNFbnRyeXBvaW50ID0gbnVsbDtcblxuXHRyZXR1cm4gW1xuXHRcdHtcblx0XHRcdG5hbWU6ICdkaXJlY3R1cy1leHRlbnNpb25zLXNlcnZlJyxcblx0XHRcdGFwcGx5OiAnc2VydmUnLFxuXHRcdFx0Y29uZmlnOiAoKSA9PiAoe1xuXHRcdFx0XHRvcHRpbWl6ZURlcHM6IHtcblx0XHRcdFx0XHRpbmNsdWRlOiBBUFBfU0hBUkVEX0RFUFMsXG5cdFx0XHRcdH0sXG5cdFx0XHR9KSxcblx0XHRcdGFzeW5jIGJ1aWxkU3RhcnQoKSB7XG5cdFx0XHRcdGF3YWl0IGxvYWRFeHRlbnNpb25zKCk7XG5cdFx0XHR9LFxuXHRcdFx0cmVzb2x2ZUlkKGlkKSB7XG5cdFx0XHRcdGlmIChpZCA9PT0gdmlydHVhbEV4dGVuc2lvbnNJZCkge1xuXHRcdFx0XHRcdHJldHVybiBpZDtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGxvYWQoaWQpIHtcblx0XHRcdFx0aWYgKGlkID09PSB2aXJ0dWFsRXh0ZW5zaW9uc0lkKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGV4dGVuc2lvbnNFbnRyeXBvaW50O1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdH0sXG5cdFx0e1xuXHRcdFx0bmFtZTogJ2RpcmVjdHVzLWV4dGVuc2lvbnMtYnVpbGQnLFxuXHRcdFx0YXBwbHk6ICdidWlsZCcsXG5cdFx0XHRjb25maWc6ICgpID0+ICh7XG5cdFx0XHRcdGJ1aWxkOiB7XG5cdFx0XHRcdFx0cm9sbHVwT3B0aW9uczoge1xuXHRcdFx0XHRcdFx0aW5wdXQ6IHtcblx0XHRcdFx0XHRcdFx0aW5kZXg6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdpbmRleC5odG1sJyksXG5cdFx0XHRcdFx0XHRcdC4uLkFQUF9TSEFSRURfREVQUy5yZWR1Y2UoKGFjYywgZGVwKSA9PiAoeyAuLi5hY2MsIFtkZXAucmVwbGFjZSgvXFwvL2csICdfJyldOiBkZXAgfSksIHt9KSxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRvdXRwdXQ6IHtcblx0XHRcdFx0XHRcdFx0ZW50cnlGaWxlTmFtZXM6ICdhc3NldHMvW25hbWVdLltoYXNoXS5lbnRyeS5qcycsXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0ZXh0ZXJuYWw6IFt2aXJ0dWFsRXh0ZW5zaW9uc0lkXSxcblx0XHRcdFx0XHRcdHByZXNlcnZlRW50cnlTaWduYXR1cmVzOiAnZXhwb3J0cy1vbmx5Jyxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9LFxuXHRcdFx0fSksXG5cdFx0fSxcblx0XTtcblxuXHRhc3luYyBmdW5jdGlvbiBsb2FkRXh0ZW5zaW9ucygpIHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBleHRlbnNpb25zUGF0aEV4aXN0cyA/IGF3YWl0IHJlc29sdmVGc0V4dGVuc2lvbnMoRVhURU5TSU9OU19QQVRIKSA6IG5ldyBNYXAoKTtcblx0XHRjb25zdCBtb2R1bGVFeHRlbnNpb25zID0gYXdhaXQgcmVzb2x2ZU1vZHVsZUV4dGVuc2lvbnMoQVBJX1BBVEgpO1xuXG5cdFx0Y29uc3QgcmVnaXN0cnlFeHRlbnNpb25zID0gZXh0ZW5zaW9uc1BhdGhFeGlzdHNcblx0XHRcdD8gYXdhaXQgcmVzb2x2ZUZzRXh0ZW5zaW9ucyhwYXRoLmpvaW4oRVhURU5TSU9OU19QQVRILCAnLnJlZ2lzdHJ5JykpXG5cdFx0XHQ6IG5ldyBNYXAoKTtcblxuXHRcdGNvbnN0IG1vY2tTZXR0aW5nID0gKHNvdXJjZSwgZm9sZGVyLCBleHRlbnNpb24pID0+IHtcblx0XHRcdGNvbnN0IHNldHRpbmdzID0gW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6IGV4dGVuc2lvbi5uYW1lLFxuXHRcdFx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRcdFx0Zm9sZGVyOiBmb2xkZXIsXG5cdFx0XHRcdFx0YnVuZGxlOiBudWxsLFxuXHRcdFx0XHRcdHNvdXJjZTogc291cmNlLFxuXHRcdFx0XHR9LFxuXHRcdFx0XTtcblxuXHRcdFx0aWYgKGV4dGVuc2lvbi50eXBlID09PSAnYnVuZGxlJykge1xuXHRcdFx0XHRzZXR0aW5ncy5wdXNoKFxuXHRcdFx0XHRcdC4uLmV4dGVuc2lvbi5lbnRyaWVzLm1hcCgoZW50cnkpID0+ICh7XG5cdFx0XHRcdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0XHRcdFx0Zm9sZGVyOiBlbnRyeS5uYW1lLFxuXHRcdFx0XHRcdFx0YnVuZGxlOiBleHRlbnNpb24ubmFtZSxcblx0XHRcdFx0XHRcdHNvdXJjZTogc291cmNlLFxuXHRcdFx0XHRcdH0pKSxcblx0XHRcdFx0KTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHNldHRpbmdzO1xuXHRcdH07XG5cblx0XHQvLyBkZWZhdWx0IHRvIGVuYWJsZWQgZm9yIGFwcCBleHRlbnNpb24gaW4gZGV2ZWxvcGVyIG1vZGVcblx0XHRjb25zdCBleHRlbnNpb25TZXR0aW5ncyA9IFtcblx0XHRcdC4uLkFycmF5LmZyb20obG9jYWxFeHRlbnNpb25zLmVudHJpZXMoKSkuZmxhdE1hcCgoW2ZvbGRlciwgZXh0ZW5zaW9uXSkgPT5cblx0XHRcdFx0bW9ja1NldHRpbmcoJ2xvY2FsJywgZm9sZGVyLCBleHRlbnNpb24pLFxuXHRcdFx0KSxcblx0XHRcdC4uLkFycmF5LmZyb20obW9kdWxlRXh0ZW5zaW9ucy5lbnRyaWVzKCkpLmZsYXRNYXAoKFtmb2xkZXIsIGV4dGVuc2lvbl0pID0+XG5cdFx0XHRcdG1vY2tTZXR0aW5nKCdtb2R1bGUnLCBmb2xkZXIsIGV4dGVuc2lvbiksXG5cdFx0XHQpLFxuXHRcdFx0Li4uQXJyYXkuZnJvbShyZWdpc3RyeUV4dGVuc2lvbnMuZW50cmllcygpKS5mbGF0TWFwKChbZm9sZGVyLCBleHRlbnNpb25dKSA9PlxuXHRcdFx0XHRtb2NrU2V0dGluZygncmVnaXN0cnknLCBmb2xkZXIsIGV4dGVuc2lvbiksXG5cdFx0XHQpLFxuXHRcdF07XG5cblx0XHRleHRlbnNpb25zRW50cnlwb2ludCA9IGdlbmVyYXRlRXh0ZW5zaW9uc0VudHJ5cG9pbnQoXG5cdFx0XHR7IG1vZHVsZTogbW9kdWxlRXh0ZW5zaW9ucywgbG9jYWw6IGxvY2FsRXh0ZW5zaW9ucywgcmVnaXN0cnk6IHJlZ2lzdHJ5RXh0ZW5zaW9ucyB9LFxuXHRcdFx0ZXh0ZW5zaW9uU2V0dGluZ3MsXG5cdFx0KTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF1UyxTQUFTLHVCQUF1QjtBQUN2VSxTQUFTLDhCQUE4QixxQkFBcUIsK0JBQStCO0FBQzNGLE9BQU8sVUFBVTtBQUNqQixP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
