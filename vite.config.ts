import type { ConfigEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

export default async ({ command, mode }: ConfigEnv) => {
  const plugins: any[] = [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({ server: { entry: "server" } }),
  ];

  if (mode === "development") {
    const { devtools } = await import("@tanstack/devtools-vite");
    plugins.unshift(devtools({ logging: false }));
  }

  if (command === "build") {
    const { nitro } = await import("nitro/vite");
    plugins.push(nitro({ defaultPreset: "vercel" }));
  }

  return { plugins };
};
