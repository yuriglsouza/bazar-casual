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
- Ficha da cliente, filtros por período nas demais telas e exportação.
- Classificação estável de mercadorias e quitação parcial de fornecedores.
- Recuperação de senha, convite de equipe, auditoria de alterações, backup/restauração testados.
- Revisão visual autenticada em celular, navegação por rotas e rascunhos persistentes.
- Rotação do token exposto anteriormente; não executada neste lote.

Não tratar este lote como conclusão de todas as recomendações da análise.

## Segundo lote — vendas e contas a pagar

- Vendas: consulta de vendas mesmo sem recebimento, busca sem acentos, situação e intervalo de datas; edição da descrição, data, valores e vencimentos das parcelas existentes; cancelamento da venda inteira com confirmação explícita.
- Edição transacional rejeita redução abaixo do recebido, parcelas de outra venda e versão desatualizada. Aumentar uma venda quitada reabre apenas a diferença.
- Contas a pagar: despesas abertas, vencidas, próximos sete dias e quitadas; busca, totais, edição, quitação e exclusão pelos fluxos existentes.
- Acesso pelo menu lateral e por Mais no celular; menu lateral pode rolar em telas baixas.
- Lint, seis testes e build passaram. Teste SQL com papel authenticated comprovou edição, preservação dos valores recebidos e rejeição de versão antiga; revertido integralmente.
- Verificação de navegador em componentes com dados fictícios: busca, filtro de quitadas e abertura de edição passaram; larguras 320 e 390 sem overflow horizontal; nenhum erro de navegador reportado. Fixture removida antes da publicação. Isto não substitui um teste completo autenticado de todas as operações.
- Nenhuma mensagem WhatsApp foi enviada; recuperação automática continua pendente.
