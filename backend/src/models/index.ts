/**
 * Modelo de dados do FERSA CARE: uma tabela por arquivo.
 *
 * Cada `pgTable` vira uma tabela no PostgreSQL (é o equivalente às classes
 * @Entity do JPA). Depois de alterar um model, rode `npm run db:gerar` para
 * criar a migração SQL e `npm run db:migrar` para aplicá-la. Tabela nova
 * precisa ser exportada aqui, senão o drizzle-kit não a enxerga.
 */
export * from './enums.js';
export * from './usuario.model.js';
export * from './categoria.model.js';
export * from './produto.model.js';
export * from './documento.model.js';
export * from './documento-produto.model.js';
export * from './documento-acesso.model.js';
export * from './documento-visualizacao.model.js';
export * from './documento-trecho.model.js';
export * from './assistente-conversa.model.js';
export * from './assistente-mensagem.model.js';
export * from './chamado.model.js';
