# Hora do Pico

Simulador interativo de filas para testar mudanças em uma operação. Monte um turno, acompanhe onde os pedidos esperam e compare duas configurações usando os mesmos pedidos.

![Painel da cafeteria no minuto 38 de um turno simulado](docs/imagens/simulacao.png)

[Comparação de cenários](docs/imagens/comparacao.png) · [Interface no celular](docs/imagens/celular.png) · [Roteiro de apresentação](docs/apresentacao.md)

## Rodar na sua máquina

Use Node.js 24 e npm. Na pasta do repositório, execute os comandos abaixo e abra o endereço local informado pelo Vite.

```sh
npm ci
npm run dev
```

O endereço padrão é `http://127.0.0.1:5173`. No PowerShell, use `npm.cmd` se a execução de `npm.ps1` estiver bloqueada. Para servir o build de produção localmente, use `npm run build` e `npm run preview`.

## Experimento de dois minutos

1. Abra **Café da Estação**. Inicie a reprodução ou arraste a linha do tempo até **38:00** para encontrar a fila de nove pedidos no preparo.
2. Em **Comparar**, clique em **Fixar cenário atual**.
3. Volte para **Simulação**, aumente o preparo de duas para três pessoas e clique em **Aplicar mudanças**.
4. Abra **Comparar** e consulte a tabela e o gráfico. Os dois turnos recebem os mesmos 37 pedidos.

| Indicador | Duas pessoas no preparo | Três pessoas no preparo |
| --- | ---: | ---: |
| Tempo médio da chegada à entrega | 7min 46s | 4min 54s |
| Tempo P90 | 14min 31s | 8min 06s |
| Maior fila simultânea | 9 | 6 |
| Pedidos entregues em até 10 min | 25/37 (67,6%) | 37/37 (100%) |

Você também pode experimentar o food truck ou a cantina, alterar a demanda, trocar a disciplina da fila e editar até seis etapas. O CSV traz uma linha por passagem de pedido por etapa, com tempos em segundos. Use `;` como separador se seu leitor de planilhas pedir.

## Como a simulação funciona

- **Chegadas.** O motor sorteia uma possível chegada a cada segundo antes do fechamento. O perfil distribui a intensidade ao longo do turno. Pedidos por hora define a taxa esperada e o total de pedidos realizado varia com a semente.
- **Atendimento.** Todos os pedidos passam pelas etapas na ordem configurada. Cada pessoa atende um pedido por vez. O tamanho do pedido e uma variação determinística alteram o tempo base de cada atendimento. A fila é servida por chegada ou por tamanho do pedido. Em caso de empate, vale a ordem de entrada na etapa. Um atendimento em andamento termina normalmente.
- **Eventos.** O motor avança para a próxima chegada ou conclusão. Para eventos simultâneos, finaliza os atendimentos, encaminha os pedidos e só então inicia novos atendimentos. O turno continua até concluir os pedidos já recebidos. A reprodução percorre os eventos calculados.
- **Comparação.** A janela de chegadas, a meta e a sequência de horários e tamanhos precisam coincidir para calcular as diferenças. A duração de serviço de um pedido numa etapa existente permanece reproduzível ao mudar apenas a capacidade.
- **Métricas.** O tempo médio usa todos os pedidos do turno. O P90 usa o valor na posição `ceil(0,90 × n)` dos tempos ordenados. A fila máxima soma pedidos esperando nas etapas no mesmo instante. A ocupação divide os segundos ocupados pelos segundos de capacidade total da etapa até o fim do turno.

O modelo usa dados sintéticos, rotas lineares e capacidade fixa durante cada turno. Os resultados descrevem a simulação. Para extrapolar para uma operação real, é preciso medir chegadas e atendimento e calibrar o modelo.

## Código e validação

- [`src/simulation.js`](src/simulation.js) contém o motor de eventos discretos. Ele roda também no Node e é independente da interface.
- [`src/scenarios.js`](src/scenarios.js) contém os dados de demonstração e valida os limites de entrada.
- [`src/app.js`](src/app.js), [`src/views.js`](src/views.js) e [`src/chart.js`](src/chart.js) ligam o editor, o player, as métricas e a comparação ao navegador.
- [`src/storage.js`](src/storage.js) usa armazenamento local por navegador e endereço. A aplicação roda sem backend, conta ou API externa.

```sh
npm test
npm run build
npx playwright install chromium firefox
npm run test:e2e
npm run screenshots
```

Em Linux, use `npx playwright install --with-deps chromium firefox` para instalar também as dependências do sistema. O [workflow do GitHub Actions](.github/workflows/ci.yml) roda os testes do motor e as jornadas do navegador contra o build de produção. As verificações automatizadas de acessibilidade cobrem simulação, guia e comparação.
