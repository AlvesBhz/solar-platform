# Sinal da reserva: opções para decidir depois

Situação atual (20/11/2026): o site grava a reserva pela função `reservar` como CONFIRMADA e a equipe combina o pagamento depois. Enquanto a função não está publicada no Supabase, a página cai no plano B (e-mail com a solicitação).

**Em qualquer opção, antes:** recriar o banco (`remover_se.sql` → `schema.sql` → `seed_exemplo.sql`) e publicar a função `reservar`. O navegador não grava no banco (por segurança). As três opções mudam a reserva do site para **aguardando sinal** (PENDENTE), com prazo para pagar, em vez de CONFIRMADA. A equipe confirma quando o sinal entra; sem pagamento no prazo, as datas voltam a ficar livres.

## Opção A: QR Code Pix na tela + link do WhatsApp (wa.me)
- Depois do cadastro, a tela mostra o protocolo, o QR Code e o "Pix copia e cola" com o valor exato do sinal (50%) e o protocolo como identificador.
- O botão "Enviar comprovante no WhatsApp" abre o WhatsApp do cliente com uma mensagem pronta para o número da empresa.
- **Pronto em:** ~1 dia. **Custo:** zero. **Confirmação do Pix:** manual (Pix estático: o site não sabe sozinho que o pagamento entrou).

## Opção B: mensagem automática no WhatsApp para o cliente
- Ao gravar a pré-reserva, o Supabase (função `reservar` ou Database Webhook → função `notificar-whatsapp`) envia ao cliente nome, protocolo, datas, hóspedes, total, sinal, chave Pix e prazo. Quando o cliente responde, a equipe atende na conversa (janela de 24 h).
- Se o envio falhar, a reserva fica gravada, a falha é registrada e a tela oferece o link wa.me.
- **Exige** a API oficial do WhatsApp Business (Meta), direta ou por um provedor oficial (Twilio, 360dialog, Zenvia, Blip):
  - conta empresarial na Meta verificada (CNPJ; de alguns dias a ~2 semanas);
  - número ligado à API (verificar se dá para usar o mesmo número no app WhatsApp Business ao mesmo tempo);
  - modelo de mensagem aprovado, categoria "utilidade" (minutos a horas);
  - caixa de consentimento no formulário ("Aceito receber a confirmação pelo WhatsApp").
- **Custo:** centavos por mensagem (conferir o preço atual na Meta). **Confirmação do Pix:** manual.
- Não usar serviços não oficiais que imitam o WhatsApp Web (Z-API, Evolution e similares): vão contra as regras do WhatsApp e o número pode ser banido.

## Opção C: Mercado Pago (Pix dinâmico)
- QR Code gerado pelo Mercado Pago; um webhook avisa o pagamento e a reserva é confirmada sozinha (o banco já tem `SIT_PAGAMENTO` preparado para isso).
- **Custo:** taxa por transação. **Confirmação do Pix:** automática.

## Comparação
| | Pronto em | Custo | Quem inicia a conversa | Confirmação do Pix |
|---|---|---|---|---|
| A. QR Code + wa.me | ~1 dia | zero | o cliente | manual |
| B. WhatsApp automático | dias (aprovação da Meta) | centavos por mensagem | a empresa, já com os dados | manual |
| C. Mercado Pago | depois | taxa por transação | — | automática |

**Sugestão:** começar pela A e, quando a Meta aprovar o modelo de mensagem, ligar a B (o código pode ficar pronto antes, esperando só a chave da API). A C entra quando quiser a confirmação automática.

## Dados necessários para implementar
1. Chave Pix correta (o Gmail não aceita "ç"; conferir o e-mail exato cadastrado como chave), nome do titular e cidade, como estão na conta.
2. Número do WhatsApp da empresa, com DDD.
3. Prazo para pagar o sinal (hoje 30 min; com atendimento humano, sugerido de 2 a 24 h).
4. Para a B: conta na Meta direta ou por provedor oficial (direta é mais barata; provedor dá suporte e painel de atendimento).
