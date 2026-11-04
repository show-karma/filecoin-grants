import type { Loader } from "astro/loaders";
import { sanityClient } from "./sanity";

const POSTS_QUERY = `*[_type == "post" && defined(slug.current)] {
  "slug": slug.current,
  title,
  date,
  description,
  author,
  body[] {
    ...,
    _type == "image" => { ..., asset-> { _id, url, metadata { dimensions } } }
  }
}`;

/*
 * Reads published posts at build time. Sanity keeps drafts out of this query
 * on its own, so there is no draft flag to filter on.
 */
export function sanityBlogLoader(): Loader {
  return {
    name: "sanity-blog",
    async load({ store, parseData, generateDigest, logger }) {
      const posts =
        await sanityClient.fetch<
          Array<Record<string, unknown> & { slug: string }>
        >(POSTS_QUERY);
      store.clear();
      for (const { slug, ...post } of posts) {
        const data = await parseData({ id: slug, data: post });
        store.set({ id: slug, data, digest: generateDigest(data) });
      }
      logger.info(`Loaded ${posts.length} posts from Sanity`);
    },
  };
}
