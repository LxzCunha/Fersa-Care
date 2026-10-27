CREATE TYPE "public"."perfil_usuario" AS ENUM('ADMIN', 'USUARIO');--> statement-breakpoint
CREATE TYPE "public"."segmento_produto" AS ENUM('LEVE', 'PESADA', 'AGRICOLA', 'INDUSTRIAL');--> statement-breakpoint
CREATE TYPE "public"."status_usuario" AS ENUM('PENDENTE', 'ATIVO', 'INATIVO');--> statement-breakpoint
CREATE TYPE "public"."tipo_documento" AS ENUM('MANUAL', 'CATALOGO', 'VIDEO', 'TREINAMENTO', 'FICHA_TECNICA', 'BOLETIM', 'OUTRO');--> statement-breakpoint
CREATE TYPE "public"."visibilidade_documento" AS ENUM('PUBLICO', 'AUTENTICADO', 'RESTRITO');--> statement-breakpoint
CREATE TABLE "documento_acessos" (
	"documento_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"concedido_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documento_acessos_documento_id_usuario_id_pk" PRIMARY KEY("documento_id","usuario_id")
);
--> statement-breakpoint
CREATE TABLE "documento_produtos" (
	"documento_id" uuid NOT NULL,
	"produto_id" uuid NOT NULL,
	CONSTRAINT "documento_produtos_documento_id_produto_id_pk" PRIMARY KEY("documento_id","produto_id")
);
--> statement-breakpoint
CREATE TABLE "documento_visualizacoes" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "documento_visualizacoes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"documento_id" uuid NOT NULL,
	"usuario_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"titulo" varchar(200) NOT NULL,
	"descricao" text,
	"tipo" "tipo_documento" NOT NULL,
	"idioma" varchar(10) DEFAULT 'pt-BR' NOT NULL,
	"visibilidade" "visibilidade_documento" DEFAULT 'AUTENTICADO' NOT NULL,
	"publicado" boolean DEFAULT true NOT NULL,
	"arquivo_chave" varchar(120),
	"arquivo_nome" varchar(255),
	"arquivo_mime" varchar(120),
	"arquivo_tamanho" bigint,
	"url_externa" text,
	"criado_por" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"busca" "tsvector" GENERATED ALWAYS AS (to_tsvector('portuguese'::regconfig, f_unaccent(coalesce(titulo, '') || ' ' || coalesce(descricao, '')))) STORED,
	CONSTRAINT "documentos_arquivo_ou_link" CHECK (("documentos"."arquivo_chave" IS NOT NULL) <> ("documentos"."url_externa" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "produtos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" varchar(40) NOT NULL,
	"nome" varchar(160) NOT NULL,
	"segmento" "segmento_produto" NOT NULL,
	"descricao" text,
	"aplicacoes" text,
	"dimensoes" varchar(80),
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "produtos_codigo_unico" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(120) NOT NULL,
	"email" varchar(180) NOT NULL,
	"senha_hash" text NOT NULL,
	"empresa" varchar(160),
	"telefone" varchar(30),
	"perfil" "perfil_usuario" DEFAULT 'USUARIO' NOT NULL,
	"status" "status_usuario" DEFAULT 'PENDENTE' NOT NULL,
	"ultimo_acesso_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unico" UNIQUE("email"),
	CONSTRAINT "usuarios_email_minusculo" CHECK ("usuarios"."email" = lower("usuarios"."email"))
);
--> statement-breakpoint
ALTER TABLE "documento_acessos" ADD CONSTRAINT "documento_acessos_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_acessos" ADD CONSTRAINT "documento_acessos_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_produtos" ADD CONSTRAINT "documento_produtos_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_produtos" ADD CONSTRAINT "documento_produtos_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_visualizacoes" ADD CONSTRAINT "documento_visualizacoes_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documento_visualizacoes" ADD CONSTRAINT "documento_visualizacoes_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documento_acessos_usuario_idx" ON "documento_acessos" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "documento_produtos_produto_idx" ON "documento_produtos" USING btree ("produto_id");--> statement-breakpoint
CREATE INDEX "documento_visualizacoes_documento_idx" ON "documento_visualizacoes" USING btree ("documento_id");--> statement-breakpoint
CREATE INDEX "documento_visualizacoes_data_idx" ON "documento_visualizacoes" USING btree ("criado_em");--> statement-breakpoint
CREATE INDEX "documentos_busca_idx" ON "documentos" USING gin ("busca");--> statement-breakpoint
CREATE INDEX "documentos_visibilidade_idx" ON "documentos" USING btree ("visibilidade","publicado");