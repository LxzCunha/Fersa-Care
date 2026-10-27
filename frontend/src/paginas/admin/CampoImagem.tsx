import { ChevronRight } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';

// Iguais a EXTENSOES_DE_IMAGEM e IMAGEM_LIMITE_MB da API (backend/src/lib/armazenamento.ts).
const EXTENSOES = '.png,.jpg,.jpeg,.webp';
const LIMITE_MB = 5;

export function CampoImagem({
  objeto,
  rotulo,
  dica,
  urlAtual,
  arquivo,
  removerAtual,
  aoEscolher,
  aoRemoverAtual,
  erro,
}: {
  /** Usado nos textos ("Escolher foto", "Remover capa"); os dois nomes são femininos. */
  objeto: 'foto' | 'capa';
  rotulo: string;
  /** Orientação depois dos formatos aceitos. */
  dica: string;
  urlAtual: string | null;
  arquivo: File | null;
  removerAtual: boolean;
  aoEscolher: (arquivo: File | null) => void;
  aoRemoverAtual: (remover: boolean) => void;
  erro?: string;
}) {
  const idAjuda = useId();
  const [arrastando, setArrastando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const previa = useMemo(() => (arquivo ? URL.createObjectURL(arquivo) : null), [arquivo]);
  useEffect(() => () => {
    if (previa) URL.revokeObjectURL(previa);
  }, [previa]);

  const mostrando = previa ?? (removerAtual ? null : urlAtual);

  function escolher(escolhido: File | null) {
    setAviso(null);
    if (!escolhido) return aoEscolher(null);
    const extensao = escolhido.name.slice(escolhido.name.lastIndexOf('.')).toLowerCase();
    if (!EXTENSOES.split(',').includes(extensao)) {
      setAviso('Envie uma imagem PNG, JPG ou WebP.');
      return;
    }
    if (escolhido.size > LIMITE_MB * 1024 * 1024) {
      setAviso(`A imagem passa do limite de ${LIMITE_MB} MB.`);
      return;
    }
    aoEscolher(escolhido);
  }

  const Objeto = objeto === 'foto' ? 'Foto' : 'Capa';
  const valor = arquivo
    ? arquivo.name
    : removerAtual && urlAtual
      ? `${Objeto} será removida ao salvar`
      : urlAtual
        ? `${Objeto} atual`
        : `Escolher ${objeto}`;

  return (
    <div className="campo">
      <div
        className={`linha-arquivo ${arrastando ? 'arrastando' : ''} ${arquivo || (urlAtual && !removerAtual) ? '' : 'vazia'}`}
        onDragEnter={() => setArrastando(true)}
        onDragLeave={() => setArrastando(false)}
        onDrop={() => setArrastando(false)}
      >
        <span className="linha-arquivo-texto">
          <span className="campo-rotulo">{rotulo}</span>
          <span className="linha-arquivo-valor">{valor}</span>
        </span>
        <ChevronRight className="linha-arquivo-seta" aria-hidden />
        <input
          type="file"
          accept={EXTENSOES}
          aria-label={rotulo}
          aria-describedby={idAjuda}
          aria-invalid={Boolean(erro || aviso)}
          onChange={(evento) => {
            escolher(evento.target.files?.[0] ?? null);
            evento.target.value = '';
          }}
        />
      </div>
      <span className="campo-ajuda" id={idAjuda}>
        PNG, JPG ou WebP, até {LIMITE_MB} MB. {dica}
      </span>
      {(erro || aviso) && <span className="campo-erro">{erro ?? aviso}</span>}

      {mostrando && (
        <div className="previa-imagem">
          <img src={mostrando} alt={`Pré-visualização: ${rotulo.toLowerCase()}`} />
          <button
            type="button"
            className="link-acao"
            onClick={() => {
              if (arquivo) aoEscolher(null);
              else aoRemoverAtual(true);
            }}
          >
            {arquivo && urlAtual && !removerAtual ? `Manter a ${objeto} anterior` : `Remover ${objeto}`}
          </button>
        </div>
      )}
      {removerAtual && !arquivo && urlAtual && (
        <button type="button" className="link-acao" onClick={() => aoRemoverAtual(false)}>
          Desfazer: manter a {objeto} atual
        </button>
      )}
    </div>
  );
}
