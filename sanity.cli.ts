import { defineCliConfig } from "sanity/cli";
import { loadEnv } from "vite";

const { PUBLIC_SANITY_PROJECT_ID, PUBLIC_SANITY_DATASET } = loadEnv(
  "development",
  process.cwd(),
  "PUBLIC_",
);

export default defineCliConfig({
  api: {
    projectId: PUBLIC_SANITY_PROJECT_ID,
    dataset: PUBLIC_SANITY_DATASET ?? "production",
  },
});
