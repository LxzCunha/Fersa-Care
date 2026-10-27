import { ChevronRight } from 'lucide-react';
import { useId, useState } from 'react';
import { EXTENSOES_ACEITAS, LIMITE_UPLOAD_MB } from '../../config';
import { tamanhoDeArquivo } from '../../lib/formatar';

export function CampoArquivo({
  arquivo,
  arquivoAtual,
  aoEscolher,
  erro,
}: {
  arquivo: File | null;
  arquivoAtual: { nome: string; tamanho: number | null } | null;
  aoEscolher: (arquivo: File | null) => void;
  erro?: string;
}) {
  const idAjuda = useId();
  const [arrastando, setArrastando] = useState(false);

  const valor = arquivo
    ? `${arquivo.name} (${tamanhoDeArquivo(arquivo.size)})`
    : arquivoAtual
      ? `${arquivoAtual.nome} (${tamanhoDeArquivo(arquivoAtual.tamanho)})`
      : 'Escolher arquivo';

  return (
    <div className="campo">
      <div
        className={`linha-arquivo ${arrastando ? 'arrastando' : ''} ${arquivo || arquivoAtual ? '' : 'vazia'}`}
        onDragEnter={() => setArrastando(true)}
        onDragLeave={() => setArrastando(false)}
        onDrop={() => setArrastando(false)}
      >
        <span className="linha-arquivo-texto">
          <span className="campo-rotulo">{arquivo && arquivoAtual ? 'Novo arquivo' : 'Arquivo'}</span>
          <span className="linha-arquivo-valor">{valor}</span>
        </span>
        <ChevronRight className="linha-arquivo-seta" aria-hidden />
        <input
          type="file"
          accept={EXTENSOES_ACEITAS}
          aria-label="Arquivo do documento"
          aria-describedby={idAjuda}
          aria-invalid={Boolean(erro)}
          onChange={(evento) => {
            aoEscolher(evento.target.files?.[0] ?? null);
            evento.target.value = '';
          }}
        />
      </div>
      <span className="campo-ajuda" id={idAjuda}>
        {arquivo && arquivoAtual
          ? `Substitui ${arquivoAtual.nome} ao salvar.`
          : `PDF, vídeo MP4/WebM, imagem, Office, TXT, CSV ou ZIP, até ${LIMITE_UPLOAD_MB} MB.`}
      </span>
      {erro && <span className="campo-erro">{erro}</span>}
      {arquivo && (
        <button type="button" className="link-acao" onClick={() => aoEscolher(null)}>
          {arquivoAtual ? 'Manter o arquivo atual' : 'Remover'}
        </button>
      )}
    </div>
  );
}
