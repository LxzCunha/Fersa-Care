CREATE TABLE "documento_trechos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documento_id" uuid NOT NULL,
	"ordem" integer NOT NULL,
	"conteudo" text NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documento_trechos_ordem_unica" UNIQUE("documento_id","ordem")
);
--> statement-breakpoint
ALTER TABLE "documento_trechos" ADD CONSTRAINT "documento_trechos_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documento_trechos_embedding_idx" ON "documento_trechos" USING hnsw ("embedding" vector_cosine_ops);