import { z, type ZodObject, type ZodRawShape } from 'zod';

/**
 * Base environment variables required by all HMC apps.
 */
const baseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(32),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  APP_URL: z.string().url().default('http://localhost:3000'),
  ENCRYPTION_KEY: z.string().min(32),
});

/**
 * Create a validated environment config by merging base schema with app-specific extensions.
 *
 * Usage:
 *   const env = createEnvConfig({
 *     ANTHROPIC_API_KEY: z.string().optional(),
 *     STRIPE_SECRET_KEY: z.string().optional(),
 *   });
 */
export function createEnvConfig<T extends ZodRawShape>(
  extensions?: T
): z.infer<ZodObject<typeof baseEnvSchema.shape & T>> {
  const schema = extensions
    ? baseEnvSchema.extend(extensions)
    : baseEnvSchema;

  return schema.parse(process.env) as z.infer<ZodObject<typeof baseEnvSchema.shape & T>>;
}
