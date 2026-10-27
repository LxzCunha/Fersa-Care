import { z } from 'zod';

/** Pergunta enviada pela bolinha de chat. */
export const esquemaPergunta = z.object({
  pergunta: z
    .string({ error: 'Escreva a sua pergunta.' })
    .trim()
    .min(2, 'Escreva a sua pergunta.')
    .max(1000, 'Use no máximo 1000 caracteres.'),
  /** Continua uma conversa já começada (sem ele, começa outra). */
  conversaId: z.uuid('Conversa inválida.').optional(),
});

export type DadosPergunta = z.infer<typeof esquemaPergunta>;
