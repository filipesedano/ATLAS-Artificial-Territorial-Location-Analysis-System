# Preparação de voz — prévia 0.1

O cartão do equipamento no modo API LOCAL inclui “Falar com o ATLAS • preparar”. Esta entrega prepara o fluxo; não reconhece fala, não acessa microfone/câmera, não grava áudio e não usa serviço de reconhecimento do navegador.

O painel explica o plano de processamento local no servidor autorizado. A captura permanece desabilitada até escolha e validação do transcritor, do hardware e da conexão. Testar texto exige reconhecer que esse ensaio não concede acesso ao microfone. A autorização real de áudio será uma etapa futura, independente e revogável.

Fluxo: abrir cartão → preparar → reconhecer aviso → digitar uma das quatro perguntas → revisar intenção e equipamento → confirmar → consultar API existente. Somente o código da intenção e o identificador do ativo seguem para a API; a frase digitada não é enviada. Não há armazenamento de texto pelo aplicativo. Editar, cancelar, retirar o reconhecimento do aviso, fechar cartão, mudar modo ou trocar equipamento invalida o rascunho. A consulta enviada após confirmação não é desfeita por cancelar posteriormente.

A lista fechada de perguntas limita o ensaio a estado, referências, capacidades e política cadastrada. Não interpreta comandos livres. O servidor continua impondo autenticação e escopo independentemente da interface.

Validação em 19/09/2026: 73 testes passaram no ambiente Linux/Node 24.19.0. Novos testes executam o estado do rascunho real da página em VM: confirmação, edição, cancelamento, revogação e rejeição de pedidos não reconhecidos. Sintaxe JavaScript e diff verificados. Layout, teclado/toque e integração visual no Windows continuam pendentes; não representam testes de áudio.

Próxima etapa: receber sistema operacional, CPU e RAM do servidor; escolher e validar transcritor local; estabelecer limites de duração, indicador de captura e encerramento/cancelamento; testar que não há envio a terceiros e que o áudio é descartado conforme política. Sem inicialização automática da escuta.
