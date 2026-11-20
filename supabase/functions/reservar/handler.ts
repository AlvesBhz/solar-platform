// Lógica da função "reservar": valida o pedido do site, segura as datas (criar_pre_reserva) e grava o cadastro
// e o aceite (confirmar_reserva). A reserva fica PENDENTE até o hóspede pagar o sinal por Pix (QR Code na tela)
// e a equipe confirmar com confirmar_sinal; sem sinal no prazo (30 min), as datas voltam a ficar livres.
// Só usa Request/Response, então roda no Supabase (Deno) e nos testes (Node).

export interface Banco {
  rpc(nome: string, args: Record<string, unknown>): Promise<{ data: any; error: { message: string; code?: string } | null }>;
}
export interface Arquivos {
  // grava no bucket privado "documentos" (Storage do Supabase)
  enviar(caminho: string, bytes: Uint8Array, mime: string): Promise<{ error: { message: string } | null }>;
}
export interface Ambiente {
  origensPermitidas: string[];        // ex.: ["https://alvesbhz.github.io"]
  turnstileSecret?: string;           // se definido, exige o captcha Cloudflare Turnstile
  limitePorHora?: number;             // pedidos por IP e por hora (contados no banco, valem para todas as cópias da função)
  arquivos?: Arquivos;                // onde gravar as fotos dos documentos
  documentoObrigatorio?: boolean;     // exige a foto do documento do titular (padrão: sim)
}

// fotos aceitas: até 8 arquivos, 5 MB cada, conferidas pelo conteúdo (não só pela extensão)
const MAX_FOTOS = 8, MAX_BYTES = 5 * 1024 * 1024;
const CAMPOS_FOTO = /^doc_(titular|acompanhante_[1-6])_(frente|verso)$/;
function tipoImagem(b: Uint8Array): { mime: string; ext: string } | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { mime: "image/webp", ext: "webp" };
  return null;
}
// valor de função escalar: o supabase-js devolve o valor; outros clientes, uma linha
const escalar = (d: any) => (Array.isArray(d) ? Object.values(d[0] ?? {})[0] : d && typeof d === "object" ? Object.values(d)[0] : d);
async function hash(texto: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("solar:" + texto));
  return Array.from(new Uint8Array(d)).map((x) => x.toString(16).padStart(2, "0")).join("");
}

const CHALE = "casa-do-mirante";
const MAX_NOITES = 7;
const MOTIVOS: Record<string, string> = {
  datas_invalidas: "O check-out precisa ser depois do check-in.",
  data_passada: "A data de check-in já passou.",
  estadia_longa: "A estadia passa do máximo de 7 noites.",
  unidade_inativa: "O chalé não está disponível no momento.",
  capacidade: "O chalé recebe até 2 adultos e 2 crianças.",
  sem_tarifa: "A agenda ainda não está aberta para essas datas.",
  fechado: "Uma das noites escolhidas não está disponível.",
  sem_chegada: "Não há check-in nesse dia.",
  sem_saida: "Não há check-out nesse dia.",
  min_noites: "A estadia é menor que o mínimo de noites para essas datas.",
  ocupado: "Essas datas acabaram de ser reservadas. Escolha outras datas.",
};

const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const inteiro = (v: unknown) => (Number.isInteger(v) ? (v as number) : NaN);
const dataIso = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) ? v : "");

export function cpfValido(cpf: string): boolean {
  const s = cpf.replace(/\D/g, "");
  if (s.length !== 11 || /^(\d)\1{10}$/.test(s)) return false;
  for (let t = 9; t < 11; t++) {
    let soma = 0;
    for (let i = 0; i < t; i++) soma += Number(s[i]) * (t + 1 - i);
    if (((soma * 10) % 11) % 10 !== Number(s[t])) return false;
  }
  return true;
}

interface Pedido {
  reserva: { checkin: string; checkout: string; adultos: number; criancas: number; criancasMaiores: number; bebes: number };
  titular: { nome: string; email: string; telefone: string; nacionalidade: string; cpf: string | null; passaporte: string | null; paisPassaporte: string | null; validadePassaporte: string | null };
  acompanhantes: Array<Record<string, unknown>>;
}

/** devolve o pedido limpo ou a lista de problemas */
export function validar(corpo: any): { pedido?: Pedido; erros: string[] } {
  const erros: string[] = [];
  const r = corpo?.reserva ?? {}, t = corpo?.titular ?? {};
  const checkin = dataIso(r.checkin), checkout = dataIso(r.checkout);
  const adultos = inteiro(r.adultos), criancas = inteiro(r.criancas), bebes = inteiro(r.bebes);
  const criancasMaiores = r.criancasMaiores === undefined ? 0 : inteiro(r.criancasMaiores); // 9 a 13 anos
  if (!checkin || !checkout || checkout <= checkin) erros.push("datas inválidas");
  else if ((Date.parse(checkout) - Date.parse(checkin)) / 864e5 > MAX_NOITES) erros.push("estadia acima de 7 noites");
  if (!(adultos >= 1 && adultos <= 2) || !(criancas >= 0) || !(bebes >= 0) || !(criancasMaiores >= 0) || criancas + criancasMaiores + bebes > 2) erros.push("hóspedes inválidos");

  const nome = texto(t.nome, 120), email = texto(t.email, 160).toLowerCase(), telefone = texto(t.telefone, 30);
  if (nome.length < 3) erros.push("nome do titular");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) erros.push("e-mail");
  if (telefone.replace(/\D/g, "").length < 10) erros.push("telefone");

  const nacionalidade = texto(t.nacionalidade, 2).toUpperCase();
  let cpf: string | null = null, passaporte: string | null = null, paisPassaporte: string | null = null, validade: string | null = null;
  if (!/^[A-Z]{2}$/.test(nacionalidade)) erros.push("nacionalidade");
  else if (nacionalidade === "BR") {
    cpf = texto(t.cpf, 20).replace(/\D/g, "");
    if (!cpfValido(cpf)) erros.push("CPF");
  } else {
    passaporte = texto(t.passaporte, 30).toUpperCase();
    paisPassaporte = texto(t.paisPassaporte, 2).toUpperCase();
    validade = dataIso(t.validadePassaporte);
    if (!/^[A-Z0-9]{5,20}$/.test(passaporte)) erros.push("passaporte");
    if (!/^[A-Z]{2}$/.test(paisPassaporte)) erros.push("país do passaporte");
    if (!validade || (checkout && validade < checkout)) erros.push("passaporte precisa valer até a saída");
  }

  const lista = Array.isArray(corpo?.acompanhantes) ? corpo.acompanhantes.slice(0, 6) : [];
  const acompanhantes = lista.map((a: any) => ({
    tipo: ["adulto", "crianca", "bebe"].includes(a?.tipo) ? a.tipo : "adulto",
    nome: texto(a?.nome, 80), sobrenome: texto(a?.sobrenome, 80),
    ...(Number.isInteger(a?.idade) ? { idade: a.idade } : {}),
  }));
  const adultosExtras = acompanhantes.filter((a: any) => a.tipo === "adulto" && a.nome.length >= 2 && a.sobrenome.length >= 2).length;
  if (adultosExtras < adultos - 1) erros.push("nome e sobrenome dos adultos");

  if (erros.length) return { erros };
  return { erros, pedido: { reserva: { checkin, checkout, adultos, criancas, criancasMaiores, bebes }, titular: { nome, email, telefone, nacionalidade, cpf, passaporte, paisPassaporte, validadePassaporte: validade }, acompanhantes } };
}

export function criarHandler(banco: Banco, amb: Ambiente) {
  return async function handler(req: Request): Promise<Response> {
    const origem = req.headers.get("origin") ?? "";
    const permitida = amb.origensPermitidas.includes(origem);
    const cors: Record<string, string> = {
      ...(permitida ? { "Access-Control-Allow-Origin": origem, Vary: "Origin" } : {}),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, authorization, apikey",
      "Access-Control-Max-Age": "86400",
    };
    const resp = (status: number, corpo: unknown) =>
      new Response(status === 204 ? null : JSON.stringify(corpo), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8" } });
    const interno = () => resp(500, { erro: "interno", mensagem: "Não foi possível concluir agora. Tente de novo em instantes." });

    if (req.method === "OPTIONS") return resp(204, null);
    if (req.method !== "POST") return resp(405, { erro: "metodo", mensagem: "Método não permitido." });
    // a origem só barra navegadores; scripts são contidos pelo limite por IP, pelo captcha e pelas regras do banco
    if (!permitida) return resp(403, { erro: "origem", mensagem: "Origem não autorizada." });
    if (Number(req.headers.get("content-length") ?? 0) > MAX_FOTOS * MAX_BYTES + 100_000) return resp(413, { erro: "tamanho", mensagem: "Arquivos grandes demais." });

    // limite por visitante, contado no banco antes de qualquer outra coisa. O IP vem da Cloudflare
    // (cf-connecting-ip / sb-forwarded-for), que não deixa o visitante falsificar o cabeçalho.
    const ip = (req.headers.get("cf-connecting-ip") ?? req.headers.get("sb-forwarded-for") ?? req.headers.get("x-forwarded-for") ?? "desconhecido").split(",")[0].trim();
    const tent = await banco.rpc("registrar_tentativa", { p_chave: await hash(ip), p_limite: amb.limitePorHora ?? 6 });
    if (tent.error) return interno();
    if (escalar(tent.data) === false) return resp(429, { erro: "limite", mensagem: "Muitas tentativas. Tente de novo mais tarde ou fale com a pousada." });

    // o pedido chega como JSON ou como formulário com as fotos (campo "dados" com o JSON)
    let corpo: any, form: FormData | null = null;
    try {
      if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
        form = await req.formData();
        corpo = JSON.parse(String(form.get("dados") ?? "{}"));
      } else corpo = await req.json();
    } catch { return resp(400, { erro: "json", mensagem: "Pedido inválido." }); }

    // isca para robôs: campo escondido no formulário que gente não preenche. Responde como se tivesse dado certo.
    if (texto(corpo?.site, 50)) return resp(200, { ok: true, cd_reserva: "SE-00000000", vl_total: 0, vl_sinal: 0 });

    // captcha (opcional): só exige quando o segredo do Turnstile está configurado
    if (amb.turnstileSecret) {
      const token = texto(corpo?.token, 2048);
      const ok = token && (await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret: amb.turnstileSecret, response: token, remoteip: ip }),
      }).then((r) => r.json()).then((j) => j.success === true).catch(() => false));
      if (!ok) return resp(400, { erro: "captcha", mensagem: "Não foi possível validar que você não é um robô. Atualize a página e tente de novo." });
    }

    const { pedido, erros } = validar(corpo);

    // fotos dos documentos: confere tipo real e tamanho antes de reservar
    const fotos: Array<{ campo: string; bytes: Uint8Array; mime: string; ext: string }> = [];
    if (form) {
      for (const [campo, valor] of form.entries()) {
        if (!CAMPOS_FOTO.test(campo) || typeof valor === "string") continue;
        const bytes = new Uint8Array(await (valor as Blob).arrayBuffer());
        const tipo = tipoImagem(bytes);
        if (!tipo || bytes.length > MAX_BYTES) { erros.push("foto do documento (envie JPG, PNG ou WEBP de até 5 MB)"); break; }
        fotos.push({ campo, bytes, ...tipo });
        if (fotos.length > MAX_FOTOS) { erros.push("fotos demais"); break; }
      }
    }
    if ((amb.documentoObrigatorio ?? true) && !fotos.some((f) => f.campo === "doc_titular_frente")) erros.push("foto do documento do titular");
    if (!pedido || erros.length) return resp(422, { erro: "validacao", mensagem: "Confira os dados: " + erros.join(", ") + ".", campos: erros });
    const { reserva: r, titular: t } = pedido;

    // quem já segura datas sem ter pago o sinal não segura outras
    const aberta = await banco.rpc("pre_reserva_em_aberto", { p_email: t.email, p_cpf: t.cpf, p_passaporte: t.passaporte });
    if (aberta.error) return interno();
    if (escalar(aberta.data) === true) return resp(409, { erro: "indisponivel", motivo: "pendente_em_aberto", mensagem: "Você já tem uma pré-reserva aguardando o Pix do sinal. Pague o Pix dela ou aguarde 30 minutos para fazer outra." });

    // 1) segura as datas por 30 minutos
    const pre = await banco.rpc("criar_pre_reserva", {
      p_cd_unidade: CHALE, p_checkin: r.checkin, p_checkout: r.checkout, p_adultos: r.adultos, p_criancas: r.criancas, p_bebes: r.bebes, p_criancas_maiores: r.criancasMaiores,
    });
    if (pre.error) {
      const motivo = pre.error.message;
      if (MOTIVOS[motivo]) return resp(409, { erro: "indisponivel", motivo, mensagem: MOTIVOS[motivo] });
      return interno();
    }
    const cd = Array.isArray(pre.data) ? pre.data[0]?.cd_reserva : pre.data?.cd_reserva;
    if (!cd) return interno();

    // 2) grava as fotos na pasta da reserva (bucket privado); se falhar, a pré-reserva vence sozinha
    const documentos: Array<Record<string, unknown>> = [];
    for (const f of fotos) {
      const [, quem, lado] = f.campo.match(CAMPOS_FOTO)!;
      const n = quem.startsWith("acompanhante_") ? Number(quem.split("_")[1]) : 0;
      const caminho = `${cd}/${quem.replace("_", "-")}-${lado}.${f.ext}`;
      if (!amb.arquivos) return interno();
      const up = await amb.arquivos.enviar(caminho, f.bytes, f.mime);
      if (up.error) return interno();
      const pessoa = n ? [pedido.acompanhantes.filter((a: any) => a.tipo === "adulto")[n - 1]].map((a: any) => a ? `${a.nome} ${a.sobrenome}`.trim() : `Acompanhante ${n}`)[0] : t.nome;
      documentos.push({ pessoa, tipo: n ? "ACOMPANHANTE" : "TITULAR", lado: lado.toUpperCase(), caminho, mime: f.mime, bytes: f.bytes.length });
    }

    // 3) grava o hóspede com o documento, os acompanhantes e o aceite da política
    const conf = await banco.rpc("confirmar_reserva", {
      p_cd_reserva: cd, p_nome: t.nome, p_email: t.email, p_telefone: t.telefone, p_nacionalidade: t.nacionalidade,
      p_cpf: t.cpf, p_passaporte: t.passaporte, p_pais_passaporte: t.paisPassaporte, p_validade_passaporte: t.validadePassaporte,
      p_emissao_passaporte: null, p_acompanhantes: pedido.acompanhantes,
    });
    if (conf.error) {
      // a pré-reserva sem confirmação vence sozinha em 30 minutos e libera as datas
      if (conf.error.message === "passaporte_vencido") return resp(422, { erro: "validacao", mensagem: "O passaporte precisa valer até o dia da saída." });
      if (conf.error.message === "pre_reserva_expirada") return resp(409, { erro: "expirada", mensagem: "O tempo para concluir passou. Consulte as datas de novo." });
      return interno();
    }
    if (documentos.length) {
      const reg = await banco.rpc("registrar_documentos", { p_cd_reserva: cd, p_documentos: documentos });
      if (reg.error) return interno();
    }
    const linha = Array.isArray(conf.data) ? conf.data[0] : conf.data;
    return resp(200, { ok: true, cd_reserva: linha?.cd_reserva ?? cd, vl_total: Number(linha?.vl_total), vl_sinal: Number(linha?.vl_sinal), dt_expira: linha?.dt_expira ?? null, documentos: documentos.length });
  };
}
