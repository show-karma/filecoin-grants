import { createClient } from "@sanity/client";
import {
  createImageUrlBuilder,
  type SanityImageSource,
} from "@sanity/image-url";

export const sanityConfig = {
  projectId: import.meta.env.PUBLIC_SANITY_PROJECT_ID as string,
  dataset:
    (import.meta.env.PUBLIC_SANITY_DATASET as string | undefined) ??
    "production",
  apiVersion: "2026-10-01",
};

export const sanityClient = createClient({ ...sanityConfig, useCdn: false });

const builder = createImageUrlBuilder(sanityClient);

export function imageUrl(source: SanityImageSource) {
  return builder.image(source).auto("format").fit("max");
}
