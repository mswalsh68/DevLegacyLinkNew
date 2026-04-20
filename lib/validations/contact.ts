import { z } from 'zod'

// Used by the landing page ContactCTA ("Request Access") form
export const accessRequestSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name is too long'),
  email: z
    .string()
    .email('Please enter a valid email address'),
  role: z
    .string()
    .max(100)
    .optional(),
  program: z
    .string()
    .max(150, 'Program name is too long')
    .optional(),
})

export type AccessRequestData = z.infer<typeof accessRequestSchema>

// Used by the full /contact page form
export const contactSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name is too long'),
  email: z
    .string()
    .email('Please enter a valid email address'),
  organization: z
    .string()
    .max(150, 'Organization name is too long')
    .optional(),
  subject: z
    .string()
    .min(3, 'Subject must be at least 3 characters')
    .max(200, 'Subject is too long'),
  message: z
    .string()
    .min(10, 'Message must be at least 10 characters')
    .max(5000, 'Message is too long'),
})

export type ContactFormData = z.infer<typeof contactSchema>
