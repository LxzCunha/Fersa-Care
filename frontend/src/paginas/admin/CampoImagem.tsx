import { ImagePlus, RefreshCw, Trash } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const EXTENSOES = '.png,.jpg,.jpeg,.webp';
/** Mesmo limite da API (IMAGEM_LIMITE_MB). */
const LIMITE_MB = 5;

/**
 * Foto da peça com pré-visualização: escolher (clique ou arrastar), trocar ou
 * remover. O tipo e o tamanho são conferidos antes de enviar.
 */
export function CampoImagem({
  urlAtual,
  arquivo,
  removerAtual,
  aoEscolher,
  aoRemoverAtual,
  erro,
}: {
  /** Foto já salva (edição), ou null. */
  urlAtual: string | null;
  arquivo: File | null;
  /** A foto atual será apagada ao salvar. */
  removerAtual: boolean;
  aoEscolher: (arquivo: File | null) => void;
  aoRemoverAtual: (remover: boolean) => void;
  erro?: string;
}) {
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

  const entrada = (
    <input
      type="file"
      accept={EXTENSOES}
      aria-label="Foto da peça"
      aria-describedby={mostrando ? undefined : 'ajuda-imagem'}
      aria-invalid={Boolean(erro || aviso)}
      onChange={(evento) => {
        escolher(evento.target.files?.[0] ?? null);
        evento.target.value = '';
      }}
    />
  );

  return (
    <div className="campo">
      {mostrando ? (
        <div className="imagem-escolhida">
          <img src={mostrando} alt="Pré-visualização da foto da peça" />
          <div className="grupo-botoes">
            <label className="botao botao-secundario botao-pequeno botao-arquivo">
              <RefreshCw aria-hidden /> Trocar foto
              {entrada}
            </label>
            <button
              type="button"
              className="botao botao-fantasma botao-pequeno"
              onClick={() => {
                if (arquivo) aoEscolher(null);
                else aoRemoverAtual(true);
              }}
            >
              <Trash aria-hidden /> {arquivo && urlAtual && !removerAtual ? 'Manter a foto anterior' : 'Remover foto'}
            </button>
          </div>
        </div>
      ) : (
        <div
          className={`zona-arquivo ${arrastando ? 'arrastando' : ''}`}
          onDragEnter={() => setArrastando(true)}
          onDragLeave={() => setArrastando(false)}
          onDrop={() => setArrastando(false)}
        >
          <ImagePlus className="zona-arquivo-icone" aria-hidden />
          <span className="zona-arquivo-titulo">Clique para escolher ou arraste a foto até aqui</span>
          <span className="zona-arquivo-ajuda" id="ajuda-imagem">
            PNG, JPG ou WebP, até {LIMITE_MB} MB. Fundo branco ou transparente fica melhor no catálogo.
          </span>
          {entrada}
        </div>
      )}
      {(erro || aviso) && <span className="campo-erro">{erro ?? aviso}</span>}
      {removerAtual && !arquivo && urlAtual && (
        <button type="button" className="botao botao-fantasma botao-pequeno" onClick={() => aoRemoverAtual(false)}>
          Desfazer: manter a foto atual
        </button>
      )}
    </div>
  );
}
