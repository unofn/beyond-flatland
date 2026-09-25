import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * One MDX file per chapter per locale:
 *   src/content/chapters/<locale>/<NN-slug>.mdx
 * The entry id is "<locale>/<NN-slug>"; the URL is /<locale>/<slug>/.
 */
const chapters = defineCollection({
  loader: glob({ pattern: '*/*.mdx', base: './src/content/chapters' }),
  schema: z.object({
    title: z.string(),
    /** One line under the title. */
    subtitle: z.string(),
    /** Position in the book, 1-based. Chapters with the same slug share it across locales. */
    order: z.number().int().positive(),
    /** Used for <meta name="description"> and the contents page. */
    summary: z.string(),
    /**
     * How much visual depth the chapter's figures are allowed (0 flat ink … 4 full
     * shading plus a w cue). The book "gains a dimension" as it goes.
     */
    depth: z.number().int().min(0).max(4),
    draft: z.boolean().default(false),
  }),
});

export const collections = { chapters };
