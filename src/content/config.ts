import { defineCollection, z } from 'astro:content';

const lessonsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    chapter: z.string(),
    slideNumber: z.number(),
    totalSlides: z.number(),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    estimatedTime: z.number(),
    tags: z.array(z.string()).optional(),
    category: z.string(),
    prerequisites: z.array(z.string()).optional(),
    hasQuiz: z.boolean().default(false),
    hasCode: z.boolean().default(false),
    hasVisualization: z.boolean().default(false),
  }),
});

export const collections = {
  lessons: lessonsCollection,
};