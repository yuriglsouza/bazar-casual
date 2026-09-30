# Estabilização — 30/09/2026

## Entregue neste lote

- Next.js e eslint-config-next 16.3.8; auditoria de dependências sem vulnerabilidades no teste local.
- Valores com ponto ou vírgula decimal; formatos inválidos rejeitados.
- Vencimento mensal limitado ao último dia válido do mês.
- Datas do painel e de vendas no fuso de São Paulo; valores futuros fora do resumo atual.
- Leitura paginada completa dos registros usados nos totais; histórico com carregamento visual em lotes.
- Falhas de consulta exibidas como erro, sem apresentar saldos parciais como completos.
- Identificadores distintos para editar recebimento e cancelar venda.
- Criação transacional de venda, parcelas e pagamento, com chave de repetição da venda.
- Edição de pagamentos com bloqueio da venda/parcela e validação do saldo na transação.
- Campo separado de data de pagamento na edição de movimentação paga.
- Permissões de sessão WhatsApp restritas; recuperação de sessão global por telefone removida.
- Validação da credencial existente antes de reconectar; chamadas ao provedor com prazo máximo.
- Preferências WhatsApp editáveis quando desconectado; falha de salvamento recuperável.
- Resumo de venda paga informa quitação; links manuais não duplicam DDI.
- Layout do WhatsApp em uma coluna nas larguras intermediárias.
- Seis testes automatizados e verificação no GitHub.

## Verificação

Testes de moeda, calendário, fuso, telefone, leitura de 1.203 registros e falha parcial passaram. Lint e build passaram. Ensaios SQL com papel authenticated validaram fevereiro, soma das parcelas, repetição sem duplicação, edição, rejeição de excesso, rollback de falha intermediária, cancelamento e permissões da sessão. Todos os dados de teste foram revertidos. Tela pública de login inspecionada no navegador; fluxos internos não tiveram teste interativo autenticado. Nenhuma mensagem real foi enviada.

## Pendências da análise original

- Fila durável de mensagens, reprocessamento, reconciliação de resultados incertos e histórico visível.
- Unificação das invariantes para impedir alterações diretas de pagamentos fora das funções transacionais; teste de concorrência real em múltiplas conexões.
- Idempotência de despesas e recebimentos parciais; neste lote a chave de repetição cobre criação de vendas.
- Agregação de totais diretamente no banco para escalar; leitura completa paginada corrige truncamento, mas ainda cresce com o histórico.
- Contas a pagar, vendas editáveis/canceláveis sem recebimento, ficha da cliente, filtros por período e exportação.
- Classificação estável de mercadorias e quitação parcial de fornecedores.
- Recuperação de senha, convite de equipe, auditoria de alterações, backup/restauração testados.
- Revisão visual autenticada em celular, navegação por rotas e rascunhos persistentes.
- Rotação do token exposto anteriormente; não executada neste lote.

Não tratar este lote como conclusão de todas as recomendações da análise.
