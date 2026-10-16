import { defineCollection, z } from "astro:content";
import { sanityBlogLoader } from "./lib/sanity-blog";

const blog = defineCollection({
  loader: sanityBlogLoader(),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string(),
    author: z
      .string()
      .nullish()
      .transform((author) => author ?? undefined),
    body: z.array(z.any()),
  }),
});

export const collections = { blog };
