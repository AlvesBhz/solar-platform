"""Gera o DER (HTML) e o dicionário de dados (Markdown) do banco do Solar Inspect.

Fonte única: as tabelas, campos e relações definidos abaixo.
Uso: python3 tools/gerar-der.py   (gera database/der.html e database/dicionario-de-dados.md)
"""
from html import escape
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
ESQUEMA = "inspect"

GRUPOS = {
    "acesso": ("Acesso", "#3D5547"),      # pine-mid
    "cadastro": ("Cadastro", "#2C3E35"),  # pine
    "operacao": ("Operação", "#1C2922"),  # pine-deep
    "apoio": ("Apoio", "#44403C"),        # stone-700
}

# Campo: (nome, tipo, nulo, padrão, chave, descrição)
# chave: "PK", "FK", "PK FK", "UQ" ou ""
T = {}

def tabela(nome, grupo, x, y, desc, telas, acesso, campos, indices):
    T[nome] = dict(nome=nome, grupo=grupo, x=x, y=y, desc=desc, telas=telas, acesso=acesso, campos=campos, indices=indices)

AUD = [
    ("dt_criacao", "timestamptz", False, "now()", "", "Quando o registro foi criado."),
    ("dt_atualizacao", "timestamptz", False, "now()", "", "Última alteração; atualizada por gatilho."),
]

tabela("usuario", "acesso", 40, 90,
    "Pessoas que usam o app. Cada linha corresponde a uma conta do Supabase Auth.",
    "T02, T32", "Cada usuário lê a própria linha; admin lê e altera todas.",
    [("id_usuario", "uuid", False, "", "PK FK", "Identificador; é o mesmo id da conta em auth.users (Supabase Auth)."),
     ("nm_usuario", "text", False, "", "", "Nome completo exibido no app e nos relatórios."),
     ("cd_login", "text", False, "", "UQ", "Nome de usuário para entrar: minúsculas, 3 a 30 caracteres (letras, números, ponto, hífen, sublinhado)."),
     ("cd_cpf", "text", True, "", "UQ", "CPF com os 11 dígitos, validado pelos dígitos verificadores; alternativa ao login. Sempre exibido mascarado (LGPD)."),
     ("tp_perfil", "text", False, "'assessor'", "", "Perfil: assessor (campo), gestor (gestão) ou admin (gestão e administração)."),
     ("fl_ativo", "boolean", False, "true", "", "Pode entrar no app. Desativar bloqueia o acesso sem apagar o histórico."),
     ("dt_aceite_lgpd", "timestamptz", True, "", "", "Quando aceitou o termo de uso de localização e dados (primeiro acesso)."),
     *AUD],
    ["pk_usuario (id_usuario)", "uq_usuario_cd_login (cd_login)", "uq_usuario_cd_cpf (cd_cpf)",
     "ck_usuario_tp_perfil: assessor | gestor | admin", "ck_usuario_cd_cpf: 11 dígitos",
     "fk_usuario_auth_users: id_usuario → auth.users(id), on delete cascade"])

tabela("usuario_propriedade", "acesso", 40, 370,
    "Quais propriedades cada usuário pode ver e vistoriar. É a base das regras de acesso (RLS) de todas as tabelas.",
    "T32", "Cada usuário lê os próprios vínculos; admin gerencia.",
    [("id_usuario", "uuid", False, "", "PK FK", "Usuário vinculado."),
     ("id_propriedade", "bigint", False, "", "PK FK", "Propriedade liberada para o usuário."),
     ("dt_criacao", "timestamptz", False, "now()", "", "Quando o vínculo foi criado.")],
    ["pk_usuario_propriedade (id_usuario, id_propriedade)", "ix_usuario_propriedade_id_propriedade (id_propriedade)",
     "fk_usuario_propriedade_usuario, fk_usuario_propriedade_propriedade (on delete cascade)"])

tabela("propriedade", "cadastro", 40, 520,
    "Hotéis, pousadas e conjuntos de chalés. Define o padrão de presença herdado pelas unidades.",
    "T20, T28, T29, T33", "Leitura por quem tem vínculo; alteração só pelo admin.",
    [("id_propriedade", "bigint", False, "identity", "PK", "Identificador gerado pelo banco."),
     ("nm_propriedade", "text", False, "", "UQ", "Nome da propriedade (ex.: Pousada Solar do Espinhaço)."),
     ("tp_propriedade", "text", False, "", "", "Tipo: pousada, hotel ou chales."),
     ("tp_validacao", "text", False, "'gps_qr'", "", "Presença padrão das unidades: gps, qr ou gps_qr."),
     ("vl_latitude", "numeric(9,6)", False, "", "", "Latitude do centro da propriedade, em graus decimais (-90 a 90)."),
     ("vl_longitude", "numeric(9,6)", False, "", "", "Longitude do centro, em graus decimais (-180 a 180)."),
     ("vl_raio_m", "integer", False, "40", "", "Raio padrão aceito para a presença por GPS, em metros (10 a 500)."),
     ("fl_ativo", "boolean", False, "true", "", "Desativar esconde a propriedade sem apagar unidades nem histórico."),
     *AUD],
    ["pk_propriedade (id_propriedade)", "uq_propriedade_nm_propriedade (nm_propriedade)",
     "ck_propriedade_tp_propriedade: pousada | hotel | chales", "ck_propriedade_tp_validacao: gps | qr | gps_qr",
     "ck_propriedade_vl_raio_m: 10 a 500"])

tabela("log_evento", "apoio", 40, 820,
    "Registro de auditoria e histórico. Guarda as tentativas de presença, os envios, as mudanças de estado, o histórico de cada ocorrência (atribuição, prazo, comentários, cancelamento) e as alterações administrativas. Só recebe inclusões.",
    "T08, T26, T34", "Inclusão só por funções do servidor; leitura pelo admin e, para ocorrências, pelo gestor da propriedade.",
    [("id_log_evento", "bigint", False, "identity", "PK", "Identificador gerado pelo banco."),
     ("id_usuario", "uuid", True, "", "FK", "Quem executou; vazio para eventos automáticos."),
     ("id_propriedade", "bigint", True, "", "FK", "Propriedade relacionada; usada nas regras de acesso."),
     ("tp_evento", "text", False, "", "", "presenca_gps, presenca_qr, vistoria_enviada, estado_alterado, ocorrencia_atribuida, ocorrencia_comentada, ocorrencia_resolvida, ocorrencia_cancelada, cadastro_alterado, qr_rotacionado, usuario_alterado."),
     ("nm_entidade", "text", False, "", "", "Tabela afetada (unidade, vistoria, ocorrencia...)."),
     ("cd_registro", "text", False, "", "", "Identificador do registro afetado, em texto (aceita bigint e uuid)."),
     ("ds_evento", "text", False, "", "", "Frase legível, ex.: \"Atribuída a Governança\"."),
     ("ds_dados", "jsonb", False, "'{}'", "", "Detalhes sem segredos: coordenadas, precisão, valor anterior e novo, justificativa."),
     ("dt_evento", "timestamptz", False, "now()", "", "Quando aconteceu.")],
    ["pk_log_evento (id_log_evento)", "ix_log_evento_entidade (nm_entidade, cd_registro)",
     "ix_log_evento_dt_evento (dt_evento desc)", "ix_log_evento_id_usuario, ix_log_evento_id_propriedade",
     "Sem UPDATE e sem DELETE (gatilho e ausência de políticas)"])

tabela("configuracao", "apoio", 40, 1100,
    "Parâmetros que a especificação pede configuráveis no banco, em vez de fixos no app.",
    "T08, T12, T15", "Leitura por usuários autenticados; alteração só pelo admin.",
    [("cd_configuracao", "text", False, "", "PK", "Chave: duracao_minima_min, precisao_max_m, foto_lado_max_px, foto_qualidade, retencao_fotos_dias."),
     ("vl_configuracao", "numeric", False, "", "", "Valor numérico (ex.: 4, 50, 1600, 0.8)."),
     ("ds_configuracao", "text", False, "", "", "Para que serve e a unidade de medida."),
     ("dt_atualizacao", "timestamptz", False, "now()", "", "Última alteração.")],
    ["pk_configuracao (cd_configuracao)"])

tabela("unidade", "cadastro", 440, 480,
    "Chalés, quartos e suítes. Guarda o estado atual e a configuração de presença própria, quando diferente da propriedade.",
    "T05, T06, T08, T09, T21, T22, T33", "Leitura por quem tem vínculo com a propriedade; estado alterado pelo envio da vistoria ou pela gestão; cadastro só pelo admin.",
    [("id_unidade", "bigint", False, "identity", "PK", "Identificador gerado pelo banco."),
     ("id_propriedade", "bigint", False, "", "FK", "Propriedade a que pertence."),
     ("nm_unidade", "text", False, "", "", "Nome (ex.: Chalé Ipê, Quarto 101). Único dentro da propriedade."),
     ("tp_unidade", "text", False, "", "", "Tipo: chale, quarto ou suite."),
     ("ds_andar", "text", True, "", "", "Andar ou localização (ex.: Térreo, 1º andar)."),
     ("tp_validacao", "text", True, "", "", "Presença própria (gps, qr, gps_qr); vazio herda da propriedade."),
     ("vl_latitude", "numeric(9,6)", True, "", "", "Coordenada própria; vazia herda a da propriedade."),
     ("vl_longitude", "numeric(9,6)", True, "", "", "Coordenada própria; vazia herda a da propriedade."),
     ("vl_raio_m", "integer", True, "", "", "Raio próprio em metros; vazio herda o da propriedade."),
     ("st_unidade", "text", False, "'em_limpeza'", "", "Estado atual: em_limpeza, liberado, ocupado, bloqueado ou manutencao."),
     ("cd_hash_qr", "text", True, "", "", "Hash SHA-256 do segredo vigente do QR Code. O segredo nunca é gravado nem enviado ao app."),
     ("nr_versao_qr", "integer", False, "1", "", "Versão do QR; aumenta a cada rotação, invalidando as anteriores."),
     ("fl_ativo", "boolean", False, "true", "", "Desativar retira a unidade das listas sem apagar o histórico."),
     *AUD],
    ["pk_unidade (id_unidade)", "uq_unidade_nome (id_propriedade, nm_unidade)", "ix_unidade_id_propriedade (id_propriedade)",
     "ck_unidade_tp_unidade: chale | quarto | suite", "ck_unidade_st_unidade: em_limpeza | liberado | ocupado | bloqueado | manutencao",
     "ck_unidade_tp_validacao: gps | qr | gps_qr", "fk_unidade_propriedade (on delete restrict)"])

tabela("ambiente", "cadastro", 440, 880,
    "Cômodos da unidade, na ordem física do percurso da vistoria.",
    "T10, T11, T12, T30", "Leitura por quem tem vínculo; alteração só pelo admin.",
    [("id_ambiente", "bigint", False, "identity", "PK", "Identificador gerado pelo banco."),
     ("id_unidade", "bigint", False, "", "FK", "Unidade a que pertence."),
     ("nm_ambiente", "text", False, "", "", "Nome (ex.: Varanda, Sala, Copa, Quarto, Banheiro)."),
     ("nr_ordem", "integer", False, "", "", "Posição no percurso (1 = primeiro)."),
     ("ds_foto_referencia", "text", True, "", "", "Caminho da foto de referência no Storage (bucket referencias)."),
     ("fl_ativo", "boolean", False, "true", "", "Desativar retira o ambiente das próximas vistorias sem apagar o histórico.")],
    ["pk_ambiente (id_ambiente)", "ix_ambiente_id_unidade (id_unidade, nr_ordem)", "fk_ambiente_unidade (on delete cascade)"])

tabela("item", "cadastro", 440, 1090,
    "O que é conferido em cada ambiente.",
    "T10, T11, T30", "Leitura por quem tem vínculo; alteração só pelo admin.",
    [("id_item", "bigint", False, "identity", "PK", "Identificador gerado pelo banco."),
     ("id_ambiente", "bigint", False, "", "FK", "Ambiente a que pertence."),
     ("nm_item", "text", False, "", "", "Nome (ex.: Cama arrumada e roupa de cama)."),
     ("nr_ordem", "integer", False, "", "", "Posição dentro do ambiente."),
     ("fl_critico", "boolean", False, "false", "", "Problema neste item sugere gravidade crítica e pode bloquear a unidade."),
     ("fl_foto_obrigatoria", "boolean", False, "false", "", "Exige foto mesmo com resposta positiva (exceto N/A)."),
     ("qt_esperada", "integer", True, "", "", "Quantidade esperada, quando o item é contado (ex.: 4 toalhas)."),
     ("fl_ativo", "boolean", False, "true", "", "Desativar retira o item das próximas vistorias sem apagar o histórico.")],
    ["pk_item (id_item)", "ix_item_id_ambiente (id_ambiente, nr_ordem)", "fk_item_ambiente (on delete cascade)"])

tabela("vistoria", "operacao", 840, 90,
    "Registro final de cada vistoria enviada. É imutável: depois de gravada não pode ser alterada nem excluída.",
    "T08 a T17, T19, T23, T24, T27", "Inclusão pelo assessor com vínculo, via função de envio; leitura por quem tem vínculo; sem UPDATE e sem DELETE.",
    [("id_vistoria", "uuid", False, "", "PK", "Gerado no celular antes da primeira gravação (UUID v7, ordenado pelo tempo). Permite reenviar sem duplicar."),
     ("id_vistoria_entrada", "uuid", True, "", "FK", "Na Saída, a vistoria de Entrada da estadia; base da comparação (T13)."),
     ("id_unidade", "bigint", False, "", "FK", "Unidade vistoriada."),
     ("id_tipo_vistoria", "bigint", False, "", "FK", "Tipo de vistoria (Entrada, Saída, Preventiva…)."),
     ("id_usuario", "uuid", False, "", "FK", "Assessor que executou."),
     ("tp_validacao", "text", False, "", "", "Presença exigida no momento (gps, qr, gps_qr), congelada para o histórico."),
     ("dt_inicio", "timestamptz", False, "", "", "Presença validada e checklist aberto."),
     ("dt_fim", "timestamptz", False, "", "", "Envio confirmado no celular."),
     ("dt_recebimento", "timestamptz", False, "now()", "", "Chegada ao servidor; difere de dt_fim quando enviada offline."),
     ("vl_latitude", "numeric(9,6)", True, "", "", "Posição na validação de presença."),
     ("vl_longitude", "numeric(9,6)", True, "", "", "Posição na validação de presença."),
     ("vl_precisao_m", "numeric(6,1)", True, "", "", "Precisão informada pelo GPS, em metros."),
     ("vl_distancia_m", "numeric(7,1)", True, "", "", "Distância até a unidade, calculada no servidor (Haversine)."),
     ("fl_fora_raio", "boolean", False, "false", "", "Envio fora do raio ou sem localização; gera sinalização."),
     ("st_vistoria", "text", False, "", "", "enviada ou sinalizada. Rascunho e pendente existem só no celular."),
     ("ds_sinalizacoes", "text[]", False, "'{}'", "", "Motivos da sinalização (ex.: duracao_menor_4min, envio_fora_raio)."),
     ("ds_assinatura", "text", True, "", "", "Caminho da assinatura (PNG) no Storage."),
     ("st_unidade_resultante", "text", True, "", "", "Estado em que a unidade ficou após este envio.")],
    ["pk_vistoria (id_vistoria)", "ix_vistoria_unidade_dt_fim (id_unidade, dt_fim desc)",
     "ix_vistoria_id_tipo_vistoria, ix_vistoria_id_usuario, ix_vistoria_id_vistoria_entrada",
     "ck_vistoria_st_vistoria: enviada | sinalizada", "ck_vistoria_periodo: dt_fim >= dt_inicio",
     "Gatilho impede UPDATE e DELETE (registro imutável)"])

tabela("resposta", "operacao", 840, 560,
    "Resposta de cada item em uma vistoria. Uma por item.",
    "T10, T11, T13", "Inclusão junto com a vistoria (função de envio); leitura por quem tem vínculo; imutável.",
    [("id_vistoria", "uuid", False, "", "PK FK", "Vistoria a que pertence."),
     ("id_item", "bigint", False, "", "PK FK", "Item respondido."),
     ("nm_item", "text", False, "", "", "Nome do item no momento da vistoria; preserva o histórico se o cadastro mudar."),
     ("tp_resposta", "text", False, "", "", "ok, problema, na, igual, danificado, faltando, com_defeito ou precisa_intervencao (conforme o tipo)."),
     ("ds_observacao", "text", True, "", "", "Observação opcional."),
     ("dt_resposta", "timestamptz", False, "", "", "Última alteração da resposta no celular.")],
    ["pk_resposta (id_vistoria, id_item)", "ix_resposta_id_item (id_item)",
     "ck_resposta_tp_resposta: lista acima", "fk_resposta_vistoria (on delete cascade), fk_resposta_item (on delete restrict)"])

tabela("ocorrencia", "operacao", 840, 780,
    "Divergência que precisa de tratamento. Nasce de uma resposta negativa no envio e é tratada pela gestão. O histórico fica em log_evento.",
    "T14, T15, T20, T22, T25, T26", "Inclusão pela função de envio; leitura por quem tem vínculo; gestor e admin alteram responsável, prazo e status.",
    [("id_ocorrencia", "bigint", False, "identity", "PK", "Identificador gerado pelo banco."),
     ("id_vistoria", "uuid", False, "", "FK", "Vistoria em que foi registrada (FK composta com id_item → resposta)."),
     ("id_item", "bigint", False, "", "FK", "Item com problema (FK composta com id_vistoria → resposta)."),
     ("id_unidade", "bigint", False, "", "FK", "Repetido da vistoria para as consultas e as regras de acesso."),
     ("tp_gravidade", "text", False, "", "", "baixa, media ou critica. Crítica pode bloquear a unidade."),
     ("ds_ocorrencia", "text", True, "", "", "Descrição opcional; o padrão é a observação da resposta."),
     ("nm_responsavel", "text", True, "", "", "Pessoa ou equipe responsável (ex.: Governança)."),
     ("dt_prazo", "date", True, "", "", "Prazo para resolver."),
     ("st_ocorrencia", "text", False, "'aberta'", "", "aberta, em_tratamento, resolvida ou cancelada. Resolver não muda o estado da unidade."),
     ("dt_resolucao", "timestamptz", True, "", "", "Quando foi resolvida ou cancelada."),
     *AUD],
    ["pk_ocorrencia (id_ocorrencia)", "uq_ocorrencia_resposta (id_vistoria, id_item): uma por item, sem duplicidade",
     "ix_ocorrencia_abertas (id_unidade, tp_gravidade) where st_ocorrencia in (aberta, em_tratamento)",
     "ck_ocorrencia_tp_gravidade, ck_ocorrencia_st_ocorrencia", "fk_ocorrencia_resposta, fk_ocorrencia_unidade"])

tabela("tipo_vistoria", "cadastro", 1240, 90,
    "Tipos de vistoria e suas regras (Entrada, Saída, Manutenção preventiva e personalizados).",
    "T07, T31", "Leitura por usuários autenticados; alteração só pelo admin.",
    [("id_tipo_vistoria", "bigint", False, "identity", "PK", "Identificador gerado pelo banco."),
     ("nm_tipo_vistoria", "text", False, "", "UQ", "Nome exibido (ex.: Entrada, Conferência de enxoval)."),
     ("ds_tipo_vistoria", "text", True, "", "", "Descrição mostrada na escolha do tipo (T07)."),
     ("tp_comportamento", "text", False, "", "", "entrada, saida, preventiva ou personalizada: define as respostas e a regra de estado da unidade."),
     ("tp_periodicidade", "text", False, "'por_estadia'", "", "por_estadia, semanal, mensal, trimestral ou sob_demanda."),
     ("fl_exige_entrada", "boolean", False, "false", "", "Só pode ser feita com vistoria de Entrada vinculada (caso da Saída)."),
     ("fl_exige_assinatura", "boolean", False, "true", "", "Exige assinatura antes do envio."),
     ("fl_ativo", "boolean", False, "true", "", "Só tipos ativos aparecem; um tipo sem itens não pode ser ativado."),
     ("dt_atualizacao", "timestamptz", False, "now()", "", "Última alteração.")],
    ["pk_tipo_vistoria (id_tipo_vistoria)", "uq_tipo_vistoria_nm (nm_tipo_vistoria)",
     "ck_tipo_vistoria_tp_comportamento, ck_tipo_vistoria_tp_periodicidade"])

tabela("tipo_vistoria_item", "cadastro", 1240, 370,
    "Itens que compõem cada tipo. Para manter simples: se um tipo não tiver linhas aqui, todos os itens ativos da unidade se aplicam (caso de Entrada e Saída).",
    "T10, T31", "Leitura por usuários autenticados; alteração só pelo admin.",
    [("id_tipo_vistoria", "bigint", False, "", "PK FK", "Tipo de vistoria."),
     ("id_item", "bigint", False, "", "PK FK", "Item incluído no tipo."),
     ("nr_ordem", "integer", True, "", "", "Ordem própria no tipo; vazio segue a ordem do ambiente.")],
    ["pk_tipo_vistoria_item (id_tipo_vistoria, id_item)", "ix_tipo_vistoria_item_id_item (id_item)",
     "fk_tipo_vistoria_item_tipo_vistoria, fk_tipo_vistoria_item_item (on delete cascade)"])

tabela("foto", "operacao", 1240, 560,
    "Evidências fotográficas com o carimbo de local e hora. O arquivo fica no Storage; aqui ficam o caminho e os metadados.",
    "T11, T12, T13, T24, T27", "Inclusão junto com a vistoria; leitura por quem tem vínculo; imutável. Arquivos em bucket privado com URL assinada.",
    [("id_foto", "uuid", False, "", "PK", "Gerado no celular (UUID v7); permite reenviar sem duplicar."),
     ("id_vistoria", "uuid", False, "", "FK", "Vistoria (FK composta com id_item → resposta)."),
     ("id_item", "bigint", False, "", "FK", "Item fotografado (FK composta com id_vistoria → resposta)."),
     ("ds_caminho", "text", False, "", "UQ", "Caminho no bucket privado vistorias: {id_propriedade}/{id_vistoria}/{id_foto}.jpg."),
     ("dt_captura", "timestamptz", False, "", "", "Data e hora do carimbo."),
     ("vl_latitude", "numeric(9,6)", True, "", "", "Posição na captura."),
     ("vl_longitude", "numeric(9,6)", True, "", "", "Posição na captura."),
     ("vl_precisao_m", "numeric(6,1)", True, "", "", "Precisão do GPS na captura, em metros."),
     ("fl_fora_raio", "boolean", False, "false", "", "Posição revalidada fora do raio na captura."),
     ("dt_criacao", "timestamptz", False, "now()", "", "Chegada ao servidor.")],
    ["pk_foto (id_foto)", "uq_foto_ds_caminho (ds_caminho)", "ix_foto_resposta (id_vistoria, id_item)",
     "fk_foto_resposta (on delete cascade)"])

# Relações: (filha, pai, rótulo, pontos da linha [filha → pai], pai_opcional)
W, H, RH = 290, 36, 21

def altura(n): return H + RH * len(T[n]["campos"])
def lin(n, campo):
    i = [c[0] for c in T[n]["campos"]].index(campo)
    return T[n]["y"] + H + RH * i + RH / 2
def esq(n): return T[n]["x"]
def dir_(n): return T[n]["x"] + W
def topo(n): return T[n]["y"]
def base(n): return T[n]["y"] + altura(n)
def meio(n): return T[n]["x"] + W / 2

R = [
    ("usuario_propriedade", "usuario", "id_usuario", [(meio("usuario"), topo("usuario_propriedade")), (meio("usuario"), base("usuario"))], False),
    ("usuario_propriedade", "propriedade", "id_propriedade", [(meio("propriedade"), base("usuario_propriedade")), (meio("propriedade"), topo("propriedade"))], False),
    ("log_evento", "propriedade", "id_propriedade", [(meio("propriedade"), topo("log_evento")), (meio("propriedade"), base("propriedade"))], True),
    ("log_evento", "usuario", "id_usuario", [(esq("log_evento"), lin("log_evento", "id_usuario")), (18, lin("log_evento", "id_usuario")), (18, lin("usuario", "id_usuario") + 5), (esq("usuario"), lin("usuario", "id_usuario") + 5)], True),
    ("unidade", "propriedade", "id_propriedade", [(esq("unidade"), lin("unidade", "id_propriedade")), (395, lin("unidade", "id_propriedade")), (395, lin("propriedade", "id_propriedade") + 5), (dir_("propriedade"), lin("propriedade", "id_propriedade") + 5)], False),
    ("ambiente", "unidade", "id_unidade", [(meio("unidade"), topo("ambiente")), (meio("unidade"), base("unidade"))], False),
    ("item", "ambiente", "id_ambiente", [(meio("ambiente"), topo("item")), (meio("ambiente"), base("ambiente"))], False),
    ("vistoria", "unidade", "id_unidade", [(esq("vistoria"), lin("vistoria", "id_unidade")), (790, lin("vistoria", "id_unidade")), (790, lin("unidade", "id_unidade") - 6), (dir_("unidade"), lin("unidade", "id_unidade") - 6)], False),
    ("vistoria", "tipo_vistoria", "id_tipo_vistoria", [(dir_("vistoria"), lin("vistoria", "id_tipo_vistoria")), (1185, lin("vistoria", "id_tipo_vistoria")), (1185, lin("tipo_vistoria", "id_tipo_vistoria")), (esq("tipo_vistoria"), lin("tipo_vistoria", "id_tipo_vistoria"))], False),
    ("vistoria", "usuario", "id_usuario", [(esq("vistoria"), lin("vistoria", "id_usuario")), (380, lin("vistoria", "id_usuario")), (380, lin("usuario", "id_usuario") - 5), (dir_("usuario"), lin("usuario", "id_usuario") - 5)], False),
    ("vistoria", "vistoria", "id_vistoria_entrada", [(dir_("vistoria"), lin("vistoria", "id_vistoria_entrada")), (1150, lin("vistoria", "id_vistoria_entrada")), (1150, lin("vistoria", "id_vistoria")), (dir_("vistoria"), lin("vistoria", "id_vistoria"))], True),
    ("resposta", "vistoria", "id_vistoria", [(meio("vistoria"), topo("resposta")), (meio("vistoria"), base("vistoria"))], False),
    ("resposta", "item", "id_item", [(esq("resposta"), lin("resposta", "id_item")), (760, lin("resposta", "id_item")), (760, lin("item", "id_item")), (dir_("item"), lin("item", "id_item"))], False),
    ("foto", "resposta", "id_vistoria, id_item", [(esq("foto"), 617), (dir_("resposta"), 617)], False),
    ("ocorrencia", "resposta", "id_vistoria, id_item", [(meio("resposta"), topo("ocorrencia")), (meio("resposta"), base("resposta"))], False),
    ("ocorrencia", "unidade", "id_unidade", [(esq("ocorrencia"), lin("ocorrencia", "id_unidade")), (780, lin("ocorrencia", "id_unidade")), (780, lin("unidade", "id_unidade") + 6), (dir_("unidade"), lin("unidade", "id_unidade") + 6)], False),
    ("tipo_vistoria_item", "tipo_vistoria", "id_tipo_vistoria", [(meio("tipo_vistoria"), topo("tipo_vistoria_item")), (meio("tipo_vistoria"), base("tipo_vistoria"))], False),
    ("tipo_vistoria_item", "item", "id_item", [(dir_("tipo_vistoria_item"), lin("tipo_vistoria_item", "id_item")), (1570, lin("tipo_vistoria_item", "id_item")), (1570, 1330), (meio("item"), 1330), (meio("item"), base("item"))], False),
]
LARG, ALT = 1600, 1360

PREFIXOS = [
    ("id_", "Identificador (chave primária ou estrangeira)", "bigint ou uuid", "ID_ (190 colunas)"),
    ("nm_", "Nome", "text", "NM_ (37)"),
    ("ds_", "Descrição, texto livre ou caminho de arquivo", "text, text[] ou jsonb", "DS_ (18)"),
    ("cd_", "Código (login, CPF, chave, hash)", "text", "CD_ (8)"),
    ("tp_", "Tipo ou categoria de uma lista fechada", "text + check", "TP_ (6)"),
    ("dt_", "Data ou data e hora", "timestamptz ou date", "DT_ (86)"),
    ("vl_", "Valor numérico medido (coordenada, raio, precisão)", "numeric ou integer", "VL_ (104)"),
    ("st_", "Estado ou situação (muda ao longo do tempo)", "text + check", "novo; a planilha usa STATUS sem prefixo"),
    ("fl_", "Sim ou não", "boolean", "novo; a planilha usa varchar(1) S/N em 16 colunas"),
    ("nr_", "Número de ordem ou versão", "integer", "novo"),
    ("qt_", "Quantidade", "integer", "novo"),
]


def svg():
    o = [f'<svg id="der" viewBox="0 0 {LARG} {ALT}" width="{LARG}" height="{ALT}" role="img" aria-label="Diagrama entidade-relacionamento do banco do Solar Inspect" xmlns="http://www.w3.org/2000/svg">',
         '<defs>',
         # extremidade "um" (pai obrigatório), "zero ou um" (pai opcional) e "zero ou muitos" (filha)
         '<marker id="um" viewBox="-24 -10 28 20" refX="0" refY="0" markerWidth="28" markerHeight="20" markerUnits="userSpaceOnUse" orient="auto"><path d="M-6 -7V7M-11 -7V7" class="mk"/></marker>',
         '<marker id="zero-um" viewBox="-24 -10 28 20" refX="0" refY="0" markerWidth="28" markerHeight="20" markerUnits="userSpaceOnUse" orient="auto"><path d="M-6 -7V7" class="mk"/><circle cx="-14" cy="0" r="4" class="mk-c"/></marker>',
         '<marker id="muitos" viewBox="-24 -10 28 20" refX="0" refY="0" markerWidth="28" markerHeight="20" markerUnits="userSpaceOnUse" orient="auto-start-reverse"><path d="M-12 0L0 -7M-12 0L0 7M-12 0H0" class="mk"/><circle cx="-17" cy="0" r="4" class="mk-c"/></marker>',
         '</defs>']
    for f, p, rot, pts, opc in R:
        d = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts)
        o.append(f'<path d="{d}" class="rel" marker-start="url(#muitos)" marker-end="url(#{"zero-um" if opc else "um"})"><title>{f}.{rot} → {p}</title></path>')
    for n, t in T.items():
        x, y, h = t["x"], t["y"], altura(n)
        cor = GRUPOS[t["grupo"]][1]
        o.append(f'<g class="tab" id="svg-{n}"><a href="#t-{n}">')
        o.append(f'<rect x="{x}" y="{y}" width="{W}" height="{h}" rx="10" class="caixa"/>')
        o.append(f'<path d="M{x} {y + H}V{y + 10}Q{x} {y} {x + 10} {y}H{x + W - 10}Q{x + W} {y} {x + W} {y + 10}V{y + H}Z" fill="{cor}"/>')
        o.append(f'<text x="{x + 14}" y="{y + 23}" class="t-nome">{n}</text>')
        o.append(f'<text x="{x + W - 14}" y="{y + 23}" class="t-grupo" text-anchor="end">{GRUPOS[t["grupo"]][0]}</text>')
        for i, (cn, tp, nulo, _pad, ch, _d) in enumerate(t["campos"]):
            cy = y + H + RH * i
            if i: o.append(f'<line x1="{x + 10}" y1="{cy}" x2="{x + W - 10}" y2="{cy}" class="div"/>')
            badge = ch.replace(" ", "·")
            if badge:
                o.append(f'<text x="{x + 12}" y="{cy + 14.5}" class="t-ch {"pk" if "PK" in ch else ""}">{badge}</text>')
            o.append(f'<text x="{x + 50}" y="{cy + 14.5}" class="t-campo {"b" if "PK" in ch else ""}">{cn}</text>')
            o.append(f'<text x="{x + W - 12}" y="{cy + 14.5}" class="t-tipo" text-anchor="end">{tp}{"" if nulo else " ●"}</text>')
        o.append('</a></g>')
    o.append(f'<text x="{esq("usuario") + 14}" y="{topo("usuario") - 10}" class="t-ext">id_usuario → auth.users (Supabase Auth)</text>')
    o.append('</svg>')
    return "\n".join(o)


def dicionario_html():
    out = []
    for n, t in T.items():
        nome_g, cor = GRUPOS[t["grupo"]]
        linhas = []
        for cn, tp, nulo, pad, ch, d in t["campos"]:
            linhas.append(
                f'<tr><td data-l="Campo"><code>{cn}</code>{"".join(f" <span class=chip>{escape(c)}</span>" for c in ch.split())}</td>'
                f'<td data-l="Tipo"><code>{escape(tp)}</code></td><td data-l="Obrigatório">{"não" if nulo else "sim"}</td>'
                f'<td data-l="Padrão">{f"<code>{escape(pad)}</code>" if pad else "—"}</td><td data-l="Descrição">{escape(d)}</td></tr>')
        out.append(f'''<article class="tabela" id="t-{n}">
  <header><span class="grupo" style="--g:{cor}">{nome_g}</span><h3><code>{ESQUEMA}.{n}</code></h3></header>
  <p>{escape(t["desc"])}</p>
  <dl class="meta"><div><dt>Telas</dt><dd>{escape(t["telas"])}</dd></div><div><dt>Quem acessa (RLS)</dt><dd>{escape(t["acesso"])}</dd></div></dl>
  <table class="campos"><thead><tr><th>Campo</th><th>Tipo</th><th>Obrigatório</th><th>Padrão</th><th>Descrição</th></tr></thead><tbody>
  {"".join(linhas)}
  </tbody></table>
  <details><summary>Chaves, índices e restrições</summary><ul>{"".join(f"<li><code>{escape(i.split(' ')[0])}</code> {escape(' '.join(i.split(' ')[1:]))}</li>" for i in t["indices"])}</ul></details>
</article>''')
    return "\n".join(out)


def pagina():
    ncampos = sum(len(t["campos"]) for t in T.values())
    prefixos = "".join(f"<tr><td data-l='Prefixo'><code>{p}</code></td><td data-l='Significado'>{escape(s)}</td><td data-l='Tipo no Postgres'><code>{escape(tp)}</code></td><td data-l='Na planilha'>{escape(ev)}</td></tr>" for p, s, tp, ev in PREFIXOS)
    legenda_grupos = "".join(f'<li><span class="sw" style="background:{c}"></span>{g}</li>' for g, c in GRUPOS.values())
    indice = "".join(f'<a href="#t-{n}"><code>{n}</code></a>' for n in T)
    return f'''<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Modelo de dados Solar Inspect</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
/* Tokens do Design System Solar (design-system/colors_and_type.css) */
:root {{ --pine:#2C3E35; --pine-deep:#1C2922; --pine-mid:#3D5547; --cream:#FAFAF9; --white:#FFFFFF;
  --s100:#F5F5F4; --s200:#E7E5E4; --s300:#D6D3D1; --s400:#A8A29E; --s500:#78716C; --s600:#57534E; --s700:#44403C; --s900:#1C1917;
  --warn:#B45309; --warn-bg:#FFFBEB; --ok:#059669;
  --serif:'Cormorant Garamond', Georgia, serif; --sans:'Inter', system-ui, -apple-system, sans-serif; --mono:ui-monospace, 'SF Mono', Menlo, Consolas, monospace; }}
*, *::before, *::after {{ box-sizing:border-box; }}
html {{ -webkit-text-size-adjust:100%; overflow-x:clip; }}
body {{ margin:0; background:var(--cream); color:var(--s600); font:400 0.875rem/1.6 var(--sans); overflow-x:clip; }}
.wrap {{ max-width:72rem; margin:0 auto; padding:clamp(1.5rem,4vw,3rem) max(1rem, env(safe-area-inset-right)) 4rem max(1rem, env(safe-area-inset-left)); }}
.eyebrow {{ font-size:0.6875rem; letter-spacing:0.32em; text-transform:uppercase; color:var(--s500); }}
h1, h2 {{ font-family:var(--serif); font-weight:500; color:var(--s900); letter-spacing:-0.015em; text-wrap:balance; margin:0; }}
h1 {{ font-size:clamp(2rem,1.6rem + 1.6vw,2.75rem); line-height:1.1; margin:0.5rem 0 0.75rem; }}
h2 {{ font-size:clamp(1.5rem,1.3rem + 0.8vw,1.875rem); line-height:1.15; margin:3rem 0 1rem; }}
h3 {{ margin:0; font-size:1rem; font-weight:600; color:var(--s900); }}
p {{ max-width:68ch; margin:0 0 0.75rem; }} code {{ font-family:var(--mono); font-size:0.8125em; color:var(--pine-deep); }}
.resumo {{ display:flex; flex-wrap:wrap; gap:0.5rem; margin:1.25rem 0 0; padding:0; list-style:none; }}
.resumo li {{ background:var(--white); border:1px solid var(--s200); border-radius:9999px; padding:0.375rem 0.875rem; font-size:0.8125rem; color:var(--s700); }}
.resumo b {{ color:var(--s900); font-variant-numeric:tabular-nums; }}
.painel {{ background:var(--white); border:1px solid var(--s200); border-radius:16px; }}
.der-barra {{ display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:0.75rem; padding:0.75rem 1rem; border-bottom:1px solid var(--s200); }}
.legenda {{ display:flex; flex-wrap:wrap; gap:0.25rem 1rem; margin:0; padding:0; list-style:none; font-size:0.75rem; }}
.legenda li {{ display:flex; align-items:center; gap:0.375rem; }} .sw {{ width:12px; height:12px; border-radius:3px; display:inline-block; }}
.zoom {{ display:flex; gap:0.375rem; }}
.zoom button {{ min-height:44px; min-width:44px; padding:0 0.875rem; border:1px solid var(--s300); border-radius:8px; background:var(--white); color:var(--s900); font:500 0.8125rem var(--sans); cursor:pointer; }}
.zoom button:hover {{ border-color:var(--s500); }} button:focus-visible, a:focus-visible, summary:focus-visible {{ outline:2px solid var(--pine); outline-offset:2px; }}
.der-area {{ overflow:auto; max-height:80svh; background:var(--cream); border-radius:0 0 16px 16px; }}
#der {{ display:block; height:auto; }}
.caixa {{ fill:var(--white); stroke:var(--s300); }} .div {{ stroke:var(--s100); }}
.rel {{ fill:none; stroke:var(--s500); stroke-width:1.4; }} .mk {{ fill:none; stroke:var(--s500); stroke-width:1.4; }} .mk-c {{ fill:var(--cream); stroke:var(--s500); stroke-width:1.4; }}
.t-nome {{ font:600 14px var(--mono); fill:#FFFFFF; }} .t-grupo {{ font:500 10px var(--sans); letter-spacing:0.12em; text-transform:uppercase; fill:rgba(255,255,255,0.7); }}
.t-campo {{ font:400 12px var(--mono); fill:var(--s900); }} .t-campo.b {{ font-weight:600; }}
.t-tipo {{ font:400 11px var(--mono); fill:var(--s500); }} .t-ch {{ font:600 9px var(--sans); fill:var(--s500); letter-spacing:0.04em; }} .t-ch.pk {{ fill:var(--warn); }}
.t-ext {{ font:italic 400 11px var(--sans); fill:var(--s500); }}
.tab a:hover .caixa {{ stroke:var(--pine); stroke-width:1.5; }}
.notas {{ display:grid; grid-template-columns:repeat(auto-fit, minmax(min(20rem,100%),1fr)); gap:0.75rem; margin:1rem 0 0; }}
.nota {{ padding:1rem 1.125rem; }} .nota h3 {{ margin-bottom:0.375rem; }} .nota p, .nota ul {{ margin:0; font-size:0.8125rem; }} .nota ul {{ padding-left:1.1rem; }}
table {{ width:100%; border-collapse:collapse; font-size:0.8125rem; }}
th {{ text-align:left; font-weight:500; font-size:0.6875rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--s500); padding:0.5rem 0.75rem; border-bottom:1px solid var(--s200); background:var(--cream); }}
td {{ padding:0.625rem 0.75rem; border-bottom:1px solid var(--s100); vertical-align:top; color:var(--s700); }}
td:first-child {{ white-space:nowrap; }}
.chip {{ display:inline-block; font:600 0.625rem var(--sans); letter-spacing:0.04em; color:var(--warn); background:var(--warn-bg); border-radius:4px; padding:0 0.3rem; margin-left:0.25rem; vertical-align:1px; }}
.indice {{ display:flex; flex-wrap:wrap; gap:0.375rem; margin:0 0 1rem; }}
.indice a {{ min-height:36px; display:inline-flex; align-items:center; padding:0 0.75rem; border:1px solid var(--s200); border-radius:9999px; background:var(--white); text-decoration:none; }}
.tabela {{ background:var(--white); border:1px solid var(--s200); border-radius:16px; padding:1.25rem; margin:0 0 1rem; scroll-margin-top:1rem; }}
.tabela > header {{ display:flex; flex-wrap:wrap; align-items:center; gap:0.625rem; margin-bottom:0.5rem; }}
.grupo {{ font-size:0.625rem; letter-spacing:0.16em; text-transform:uppercase; color:#FFFFFF; background:var(--g); border-radius:9999px; padding:0.2rem 0.6rem; }}
.meta {{ display:grid; grid-template-columns:repeat(auto-fit, minmax(min(16rem,100%),1fr)); gap:0.5rem 1.5rem; margin:0 0 1rem; font-size:0.8125rem; }}
.meta dt {{ font-size:0.6875rem; letter-spacing:0.08em; text-transform:uppercase; color:var(--s500); }} .meta dd {{ margin:0; color:var(--s700); }}
details {{ margin-top:0.75rem; font-size:0.8125rem; }} summary {{ cursor:pointer; color:var(--pine); min-height:44px; display:flex; align-items:center; }}
details ul {{ margin:0; padding-left:1.1rem; }}
footer {{ margin-top:3rem; font-size:0.75rem; color:var(--s500); }}
/* Celular: cada linha de tabela vira um cartão (sem rolagem lateral) */
@media (max-width: 640px) {{
  table, thead, tbody, tr, td {{ display:block; }} thead {{ display:none; }}
  tr {{ padding:0.625rem 0; border-bottom:1px solid var(--s200); }}
  td {{ border:0; padding:0.125rem 0; white-space:normal !important; }}
  td[data-l]:not(:first-child)::before {{ content:attr(data-l) ": "; font-size:0.6875rem; letter-spacing:0.06em; text-transform:uppercase; color:var(--s500); }}
  .tabela {{ padding:1rem; }}
}}
@media (prefers-reduced-motion: reduce) {{ * {{ scroll-behavior:auto !important; }} }}
</style></head>
<body><div class="wrap">
<header>
  <span class="eyebrow">Solar Inspect · Banco de dados</span>
  <h1>Modelo de dados</h1>
  <p>Proposta enxuta para o Supabase (PostgreSQL), feita a partir da especificação v3 e das telas T01–T34 do protótipo. Atende a aplicação com o mínimo de tabelas; cada campo está descrito no dicionário abaixo.</p>
  <ul class="resumo"><li>Esquema <b><code>{ESQUEMA}</code></b></li><li><b>{len(T)}</b> tabelas</li><li><b>{ncampos}</b> campos</li><li><b>{len(R)}</b> relações</li><li>Versão <b>1</b> · proposta</li></ul>
</header>

<h2>Diagrama</h2>
<section class="painel" aria-label="Diagrama entidade-relacionamento">
  <div class="der-barra">
    <ul class="legenda">{legenda_grupos}<li><b class="chip">PK</b> chave primária</li><li><b class="chip">FK</b> chave estrangeira</li><li><b class="chip">UQ</b> único</li><li>● obrigatório</li><li>pé de galinha = muitos · traço duplo = um · círculo = opcional</li></ul>
    <div class="zoom" role="group" aria-label="Zoom do diagrama"><button type="button" data-z="-1" aria-label="Diminuir">−</button><button type="button" data-z="0">Ajustar</button><button type="button" data-z="1" aria-label="Aumentar">+</button></div>
  </div>
  <div class="der-area" id="area">{svg()}</div>
</section>
<p style="margin-top:0.75rem;font-size:0.8125rem">Toque numa tabela do diagrama para ir à sua descrição. Nas linhas, o lado com pé de galinha é a tabela filha (que guarda a chave estrangeira).</p>

<h2>Convenções de nomenclatura</h2>
<p>Segue o padrão da planilha de referência (esquema IBP, SQL Server), adaptado ao PostgreSQL: os mesmos prefixos, porém em <b>minúsculas</b>, porque o Postgres converte nomes sem aspas para minúsculas e nomes em maiúsculas obrigariam o uso de aspas em toda consulta.</p>
<div class="painel" style="padding:0.25rem 0.75rem"><table><thead><tr><th>Prefixo</th><th>Significado</th><th>Tipo no Postgres</th><th>Na planilha</th></tr></thead><tbody>{prefixos}</tbody></table></div>
<div class="notas">
  <div class="painel nota"><h3>Tabelas e esquema</h3><p>Nomes no singular e em português (<code>unidade</code>, <code>vistoria</code>), como <code>OPERACAO</code> e <code>SISTEMA</code> na planilha. Tabela associativa leva o nome das duas (<code>usuario_propriedade</code>). Registro de eventos usa o prefixo <code>log_</code>, como <code>LOG_*</code>. Um esquema por sistema, como <code>IBP</code>: aqui, <code>{ESQUEMA}</code>.</p></div>
  <div class="painel nota"><h3>Chaves e índices</h3><p>Mesmo padrão da planilha: <code>pk_&lt;tabela&gt;</code>, <code>fk_&lt;filha&gt;_&lt;pai&gt;</code> e <code>ix_&lt;tabela&gt;_&lt;colunas&gt;</code>, mais <code>uq_</code> (único) e <code>ck_</code> (regra de valores).</p></div>
  <div class="painel nota"><h3>O que não repetir da referência</h3><ul><li>20 tabelas sem chave primária → aqui todas têm.</li><li>49 chaves estrangeiras sem índice → aqui todas têm índice.</li><li>40 chaves estrangeiras não confiáveis e 160 ligações implícitas → aqui todas as relações são declaradas e validadas.</li></ul></div>
</div>

<h2>Decisões</h2>
<div class="notas">
  <div class="painel nota"><h3>Identificadores</h3><p>Cadastros usam <code>bigint</code> gerado pelo banco. Vistoria e foto usam <code>uuid</code> v7 gerado no celular, porque nascem offline e o mesmo envio pode chegar mais de uma vez sem duplicar. <code>usuario</code> reaproveita o id do Supabase Auth.</p></div>
  <div class="painel nota"><h3>Tipos</h3><p><code>text</code> com regra <code>ck_</code> no lugar de <code>varchar(n)</code> e de tipos enum (mais fácil de evoluir); <code>timestamptz</code> para data e hora; <code>numeric</code> para coordenadas e medidas; <code>boolean</code> para sim ou não.</p></div>
  <div class="painel nota"><h3>Acesso (RLS)</h3><p>RLS ligado em todas as tabelas. A regra base: o usuário só enxerga as propriedades em <code>usuario_propriedade</code>; o admin enxerga tudo. Vistoria, resposta e foto não aceitam alteração nem exclusão. A verificação de vínculo fica numa função em esquema privado, para não repetir subconsultas em cada política.</p></div>
  <div class="painel nota"><h3>Envio e presença no servidor</h3><p>O envio entra por uma função do servidor que valida a presença (distância por Haversine, precisão, QR), grava vistoria, respostas e fotos de uma vez, cria as ocorrências e atualiza o estado da unidade. Repetir o envio com o mesmo id não duplica nada.</p></div>
  <div class="painel nota"><h3>Arquivos</h3><p>Fotos e assinaturas ficam no Storage, em bucket privado <code>vistorias</code> (acesso por URL assinada); fotos de referência no bucket <code>referencias</code>. O banco guarda só o caminho.</p></div>
  <div class="painel nota"><h3>Fora desta versão (enxuto)</h3><ul><li>Tabela de estadia: a Saída se liga à Entrada por <code>id_vistoria_entrada</code> (decisão em aberto na especificação).</li><li>Histórico de ocorrência separado: fica em <code>log_evento</code>.</li><li>Notificações, reservas e cobrança.</li><li>Segundo fator do login (definir antes da implementação).</li></ul></div>
</div>

<h2>Dicionário de dados</h2>
<nav class="indice" aria-label="Tabelas">{indice}</nav>
{dicionario_html()}

<footer>Gerado por <code>solar-inspect/tools/gerar-der.py</code> a partir de uma definição única (DER e dicionário sempre iguais). Proposta para revisão; o SQL das migrations vem na próxima etapa.</footer>
</div>
<script>
(() => {{
  const svg = document.getElementById('der'), area = document.getElementById('area'), base = {LARG};
  let z = 1;
  const ajustar = () => {{ z = Math.min(1, (area.clientWidth - 8) / base); aplicar(); }};
  const aplicar = () => {{ svg.setAttribute('width', Math.round(base * z)); svg.setAttribute('height', Math.round({ALT} * z)); }};
  document.querySelectorAll('.zoom button').forEach((b) => b.addEventListener('click', () => {{
    const d = +b.dataset.z; if (!d) return ajustar(); z = Math.max(0.3, Math.min(2, z * (d > 0 ? 1.25 : 0.8))); aplicar();
  }}));
  ajustar();
}})();
</script>
</body></html>'''


def markdown():
    l = [f"# Dicionário de dados — Solar Inspect\n",
         f"Proposta enxuta para o Supabase (PostgreSQL), esquema `{ESQUEMA}`: {len(T)} tabelas, {sum(len(t['campos']) for t in T.values())} campos e {len(R)} relações. O diagrama está em [`der.html`](./der.html).\n",
         "Gerado por `tools/gerar-der.py` (fonte única do DER e deste dicionário).\n",
         "## Convenções\n", "| Prefixo | Significado | Tipo no Postgres | Na planilha de referência |", "|---|---|---|---|"]
    l += [f"| `{p}` | {s} | `{tp}` | {ev} |" for p, s, tp, ev in PREFIXOS]
    l += ["", "Restrições: `pk_<tabela>`, `fk_<filha>_<pai>`, `ix_<tabela>_<colunas>`, `uq_` (único) e `ck_` (regra de valores). Nomes em minúsculas (o Postgres converte nomes sem aspas).\n"]
    for n, t in T.items():
        l += [f"## `{ESQUEMA}.{n}` ({GRUPOS[t['grupo']][0]})\n", t["desc"] + "\n", f"- **Telas:** {t['telas']}", f"- **Quem acessa (RLS):** {t['acesso']}\n",
              "| Campo | Tipo | Obrigatório | Padrão | Chave | Descrição |", "|---|---|---|---|---|---|"]
        l += [f"| `{cn}` | `{tp}` | {'não' if nulo else 'sim'} | {f'`{pad}`' if pad else '—'} | {ch or '—'} | {d} |" for cn, tp, nulo, pad, ch, d in t["campos"]]
        l += ["", "**Chaves, índices e restrições:** " + "; ".join(f"`{i.split(' ')[0]}` {' '.join(i.split(' ')[1:])}".strip() for i in t["indices"]) + "\n"]
    l += ["## Relações\n", "| Filha | Campo(s) | Pai | Obrigatória |", "|---|---|---|---|"]
    l += [f"| `{f}` | `{rot}` | `{p}` | {'não' if opc else 'sim'} |" for f, p, rot, _pts, opc in R]
    l += ["| `usuario` | `id_usuario` | `auth.users` (Supabase Auth) | sim |", ""]
    return "\n".join(l)


if __name__ == "__main__":
    (APP / "database").mkdir(exist_ok=True)
    (APP / "database" / "der.html").write_text(pagina(), encoding="utf-8")
    (APP / "database" / "dicionario-de-dados.md").write_text(markdown(), encoding="utf-8")
    print(f"ok: {len(T)} tabelas, {sum(len(t['campos']) for t in T.values())} campos, {len(R)} relações")
